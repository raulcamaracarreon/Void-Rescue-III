import { wrapX } from '../core/WorldWrap';
import { CONFIG } from './config';
import { vehicleProfile } from './VehicleProfile';
import type { VehicleId, VehicleProfile } from './VehicleProfile';
import { Random } from '../core/Random';
import { Terrain } from './Terrain';
import type { CombatContext, CombatState } from './combat/types';
import { emptyCombat, resolveWave, updateWave } from './combat/WaveSystem';
import { initializeScenario } from './combat/scenarios';
import type { ScenarioName } from './combat/scenarios';
import { updateColonists } from './combat/ColonistSystem';
import { updateEnemies } from './combat/EnemySystem';
import { updateBomb, updateLife, updateProjectiles, useBomb } from './combat/CombatSystem';
import { advanceWave } from './combat/Progression';
import { difficulty, difficultyProfile } from './Difficulty';
import type { Difficulty } from './Difficulty';
import { missionMode } from './MissionMode';
import { spawnMode } from './SpawnMode';
import { rescueProtocol } from './RescueProtocol';
import type { RescueProtocol } from './RescueProtocol';
import type { SpawnMode } from './SpawnMode';
import type { MissionMode } from './MissionMode';
import { startPlayerExtraction } from './combat/ColonistSystem';
export { SCENARIOS } from './combat/scenarios';
export type { ScenarioName } from './combat/scenarios';

export interface FlightInput { x: number; y: number; fire: boolean; bomb?: boolean; portal?: boolean; view?: { centerX: number; width: number } }
export const IDLE_INPUT: FlightInput = { x: 0, y: 0, fire: false };
export interface Player {
  x: number; y: number; previousX: number; previousY: number;
  vx: number; vy: number; facing: 1 | -1; thrust: number;
  alive: boolean; invulnerable: number;
}
export interface Shot { id: number; x: number; y: number; vx: number; vy: number; remaining: number; team: 'player' | 'enemy' }
export interface FlightState extends CombatState {
  seed: number; frame: number; time: number; distance: number; laps: number;
  player: Player; shots: Shot[]; shotsFired: number;
  scenario: ScenarioName; difficulty: Difficulty; missionMode: MissionMode;
  vehicleId: VehicleId;
}

export class Simulation {
  state: FlightState;
  private shotCooldown = 0;
  private nextId = 1;
  private bombHeld = false;
  private portalHeld = false;
  readonly context: CombatContext;
  readonly vehicle: VehicleProfile;

  constructor(seed = Number(CONFIG.defaultSeed), scenario: ScenarioName = 'flight-basic', selectedDifficulty: Difficulty = 'normal', selectedMissionMode: MissionMode = 'defense', selectedSpawnMode: SpawnMode = 'classic', selectedRescueProtocol: RescueProtocol = 'realistic', selectedVehicle: VehicleId = 'ship') {
    const selected = difficulty(selectedDifficulty);
    const selectedMode = missionMode(selectedMissionMode);
    this.vehicle = vehicleProfile(selectedVehicle);
    const profile = difficultyProfile(selected);
    const x = scenario === 'world-seam' ? CONFIG.worldWidth - 2 : CONFIG.startX;
    this.state = {
      ...emptyCombat(scenario !== 'flight-basic' && scenario !== 'world-seam', profile),
      seed: seed >>> 0, frame: 0, time: 0, distance: 0, laps: 0, scenario,
      difficulty: selected, missionMode: selectedMode, vehicleId: this.vehicle.id,
      spawnMode: scenario === 'dynamic-basic' ? 'dynamic' : spawnMode(selectedSpawnMode),
      rescueProtocol: rescueProtocol(selectedRescueProtocol),
      player: { x, y: CONFIG.startY, previousX: x, previousY: CONFIG.startY, vx: 0, vy: 0, facing: 1, thrust: 0, alive: true, invulnerable: 3 },
      shots: [], shotsFired: 0,
    };
    this.context = { state: this.state, terrain: new Terrain(seed), random: new Random(seed), nextId: () => this.nextId++,
      emit: (kind, x, y) => {
        this.state.events.push({ id: this.nextId++, kind, x, y, time: this.state.time });
        if (this.state.events.length > 80) this.state.events.shift();
      } };
    initializeScenario(this.context, scenario);
    // Diagnostic scenarios intentionally keep their finite scripts.
    if (scenario !== 'dynamic-basic') { this.state.spawnMode = 'classic'; this.state.director = null; }
  }

  update(dt: number, input: FlightInput): void {
    const s = this.state;
    const profile = difficultyProfile(s.difficulty);
    const p = s.player;
    const flight = this.vehicle.flight;
    if (s.enabled && s.outcome !== 'active') return;
    if (s.enabled) updateLife(this.context, dt);
    if (!p.alive) input = { ...IDLE_INPUT };
    p.previousX = p.x;
    p.previousY = p.y;
    const horizontal = Math.max(-1, Math.min(1, input.x));
    const vertical = Math.max(-1, Math.min(1, input.y));
    if (horizontal !== 0) p.facing = horizontal > 0 ? 1 : -1;
    p.thrust = Math.abs(horizontal);
    p.vx = Math.max(-flight.maxSpeed, Math.min(flight.maxSpeed,
      (p.vx + horizontal * flight.acceleration * dt) * Math.exp(-flight.drag * dt)));
    if (Math.abs(p.vx) < 0.01) p.vx = 0;
    p.vy += (vertical * flight.verticalSpeed - p.vy) * (1 - Math.exp(-flight.verticalResponse * dt));
    const unwrapped = p.x + p.vx * dt;
    if (unwrapped < 0 || unwrapped >= CONFIG.worldWidth) s.laps++;
    p.x = wrapX(unwrapped, CONFIG.worldWidth);
    // Only helicopters use ground-following clearance in reconnaissance as
    // well as combat. The original ship keeps BOTH historical altitude rules.
    // Keep clearance between the helicopter's center and its landing wheels.
    const floor = s.vehicleId === 'helicopter'
      ? this.context.terrain.height(p.x) + flight.groundClearance
      : s.enabled ? this.context.terrain.height(p.x) : CONFIG.minAltitude;
    p.y = Math.max(floor, Math.min(CONFIG.maxAltitude, p.y + p.vy * dt));
    if ((p.y === floor && p.vy < 0) || (p.y === CONFIG.maxAltitude && p.vy > 0)) p.vy = 0;
    s.distance += Math.abs(p.vx * dt);
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    if (input.fire && p.alive && this.shotCooldown <= 1e-9) {
      this.shotCooldown = profile.playerShotInterval;
      s.shotsFired++;
      s.shots.push({ id: this.nextId++, x: wrapX(p.x + p.facing * this.vehicle.weapon.muzzleOffset, CONFIG.worldWidth), y: p.y,
        vx: this.vehicle.weapon.projectileSpeed * profile.playerShotSpeed * p.facing + p.vx, vy: 0, team: 'player', remaining: CONFIG.shotLifetime });
    }
    if (s.enabled) {
      if (input.bomb && !this.bombHeld) useBomb(this.context, input);
      const contextPressed = Boolean(input.portal && !this.portalHeld);
      // The rescue beam is level-triggered, not a one-shot action. Keeping E/Y
      // held picks the next nearby colonist after the previous one boards.
      const extracting = Boolean(input.portal && s.missionMode === 'rescue'
        && startPlayerExtraction(this.context));
      updateWave(this.context, dt, contextPressed && !extracting);
      updateEnemies(this.context, dt);
      updateBomb(this.context, dt);
      updateProjectiles(this.context, dt, input.view);
      updateColonists(this.context, dt, Boolean(input.portal));
      resolveWave(this.context);
    } else {
      for (const shot of s.shots) {
        shot.x = wrapX(shot.x + shot.vx * dt, CONFIG.worldWidth);
        shot.remaining -= dt;
      }
      s.shots = s.shots.filter(shot => shot.remaining > 0);
    }
    this.bombHeld = Boolean(input.bomb); this.portalHeld = Boolean(input.portal);
    s.frame++;
    s.time = s.frame / 60;
  }

  nextWave(): boolean {
    if (!advanceWave(this.context)) return false;
    this.shotCooldown = 0; this.bombHeld = false; this.portalHeld = false;
    return true;
  }

  setDifficulty(value: Difficulty): void {
    this.state.difficulty = difficulty(value);
  }

  setMissionMode(value: MissionMode): void {
    this.state.missionMode = missionMode(value);
  }

  snapshot(): FlightState { return structuredClone(this.state); }
}
