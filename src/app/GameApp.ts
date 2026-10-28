import { FixedClock } from '../core/Clock';
import { radarSegments } from '../core/WorldWrap';
import { CONFIG } from '../game/config';
import type { VehicleId } from '../game/VehicleProfile';
import { IDLE_INPUT, SCENARIOS, Simulation } from '../game/Simulation';
import type { ScenarioName } from '../game/Simulation';
import { vehicleProfile } from '../game/VehicleProfile';
import { InputManager } from '../input/InputManager';
import { FlightRenderer } from '../render/Renderer';
import { AudioEngine, ENGINE_PITCH_DEFAULT, normalizeEnginePitch } from '../audio/AudioEngine';
import { Interface } from '../ui/Interface';
import type { AppMode, Preferences } from '../ui/Interface';
import { ControllerPanel } from '../ui/ControllerPanel';
import { DIFFICULTIES, difficulty } from '../game/Difficulty';
import { Records } from '../game/Records';
import { rescueProtocol } from '../game/RescueProtocol';
import type { PlayerRecord } from '../game/Records';
import { RecordsPanel } from '../ui/RecordsPanel';
import { wavePressure } from '../game/combat/Progression';
import { missionMode } from '../game/MissionMode';
import { spawnMode } from '../game/SpawnMode';
import { LandscapePanel } from '../ui/LandscapePanel';
import { defaultLandscapePreferences, resolveLandscape, sanitizeLandscapePreferences } from '../landscape/LandscapeConfig';
import type { LandscapePreferences } from '../landscape/LandscapeConfig';

const LANDSCAPE_SETTINGS_KEY = 'void-rescue-iii.landscape.v1';
const GAME_SETTINGS_KEY = 'void-rescue-iii.preferences.v1';
const VEHICLE_SETTINGS_KEY = 'void-rescue-iii.vehicle.v1';
function readVehicle(): VehicleId {
  try { return vehicleProfile(localStorage.getItem(VEHICLE_SETTINGS_KEY) as VehicleId).id; }
  catch { return 'ship'; }
}
function readLandscapePreferences(): LandscapePreferences {
  try { return sanitizeLandscapePreferences(JSON.parse(localStorage.getItem(LANDSCAPE_SETTINGS_KEY) ?? 'null')); }
  catch { return defaultLandscapePreferences(); }
}

function readPreferences(): Preferences {
  const defaults: Preferences = { muted: false, volume: 0.45, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, difficulty: 'normal', missionMode: 'defense', spawnMode: 'classic', rescueProtocol: 'realistic', enginePitchHz: ENGINE_PITCH_DEFAULT };
  try {
    const data: unknown = JSON.parse(localStorage.getItem(GAME_SETTINGS_KEY) ?? '{}');
    if (typeof data !== 'object' || !data) return defaults;
    const value = data as Record<string, unknown>;
    return {
      muted: typeof value.muted === 'boolean' ? value.muted : defaults.muted,
      reducedMotion: typeof value.reducedMotion === 'boolean' ? value.reducedMotion : defaults.reducedMotion,
      volume: typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : defaults.volume,
      difficulty: difficulty(value.difficulty),
      missionMode: missionMode(value.missionMode),
      spawnMode: spawnMode(value.spawnMode),
      rescueProtocol: rescueProtocol(value.rescueProtocol),
      enginePitchHz: normalizeEnginePitch(value.enginePitchHz),
    };
  } catch { return defaults; }
}

export class GameApp {
  private simulation: Simulation;
  private readonly clock = new FixedClock();
  private readonly input = new InputManager();
  private readonly audio = new AudioEngine();
  private readonly graphics: FlightRenderer;
  private readonly ui: Interface;
  private readonly controllerPanel: ControllerPanel;
  private readonly landscapePanel: LandscapePanel;
  private readonly records = new Records();
  private readonly recordsPanel: RecordsPanel;
  private run: Pick<PlayerRecord, 'id' | 'pilot' | 'difficulty' | 'missionMode' | 'spawnMode' | 'rescueProtocol' | 'vehicleId' | 'date'> | null = null;
  private mode: AppMode = 'title';
  private preferences = readPreferences();
  private selectedVehicle: VehicleId = readVehicle();
  private landscapePreferences = readLandscapePreferences();
  private previousTime = 0;
  private raf = 0;
  private disposed = false;
  private failed = false;
  private audioError: string | null = null;
  private lastTeleport = 0;

  constructor(private readonly canvas: HTMLCanvasElement, root: HTMLElement) {
    const params = new URLSearchParams(location.search);
    const rawSeed = Number(params.get('seed') ?? CONFIG.defaultSeed);
    const seed = Number.isFinite(rawSeed) ? rawSeed >>> 0 : CONFIG.defaultSeed;
    this.simulation = new Simulation(seed, 'flight-basic', this.preferences.difficulty, this.preferences.missionMode, 'classic', this.preferences.rescueProtocol, this.selectedVehicle);
    this.graphics = new FlightRenderer(canvas, seed, params.get('backend') === 'webgl2', this.landscapePreferences);
    this.graphics.renderer.onError = message => this.showError(new Error(message));
    this.graphics.renderer.onDeviceLost = info => this.showError(new Error(`Se perdió el dispositivo gráfico: ${info.message}`));
    this.ui = new Interface(root, {
      start: () => this.start(), resume: () => this.setPaused(false), restart: () => this.restart(),
      menu: () => this.menu(), pause: () => this.setPaused(true), mute: () => this.toggleMute(),
      fullscreen: () => { void this.fullscreen(); }, preferences: value => this.savePreferences(value),
      vehicle: value => this.selectVehicle(value),
      landscape: () => this.openLandscape(),
      controller: () => { this.setPaused(true); this.controllerPanel.show(); },
      result: () => this.continueResult(), pilot: value => this.records.setPilot(value),
      records: () => { this.setPaused(true); this.saveRecord(); this.recordsPanel.show(); },
    }, this.preferences, this.records.pilot, this.selectedVehicle);
    this.ui.setLandscapeTheme(resolveLandscape(this.landscapePreferences, this.simulation.state.wave, this.simulation.state.seed).style);
    this.controllerPanel = new ControllerPanel(root, this.input.controller, () => { this.input.clear(); });
    this.landscapePanel = new LandscapePanel(root, this.landscapePreferences,
      value => this.saveLandscape(value), () => this.simulation.state.wave,
      () => this.simulation.state.seed);
    this.recordsPanel = new RecordsPanel(root, this.records, () => { this.input.clear(); },
      () => ({ spawnMode: this.preferences.spawnMode, missionMode: this.preferences.missionMode,
        rescueProtocol: this.run?.rescueProtocol ?? this.preferences.rescueProtocol,
        vehicleId: this.run?.vehicleId ?? this.selectedVehicle }));
    this.audio.setMuted(this.preferences.muted);
    this.audio.setVolume(this.preferences.volume);
    this.audio.setEnginePitch(this.preferences.enginePitchHz);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
  }

  async init(): Promise<void> {
    await this.graphics.init();
    this.graphics.reset(this.simulation.state, true);
    // Compile visible materials before removing the boot message.
    this.graphics.draw(this.simulation.state, 0, 1 / 60, false, true, this.preferences.reducedMotion);
    document.querySelector('#loading')?.remove();
    this.ui.update(this.simulation.state, this.graphics.metrics(), false);
    if (import.meta.env.DEV) window.__VOID_RESCUE__ = this.diagnostics();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    if (this.disposed || this.failed) return;
    const elapsed = this.previousTime ? Math.max(0, (now - this.previousTime) / 1000) : 1 / 60;
    this.previousTime = now;
    this.input.poll();
    this.controllerPanel.update();
    if (this.input.disconnected && this.mode === 'playing') { this.setPaused(true); this.ui.disconnected(); }
    const menuInput = this.input.menu();
    if (this.landscapePanel.open) {
      this.input.consume('pause');
      this.landscapePanel.navigatePad(menuInput);
    } else if (this.recordsPanel.open) {
      if (this.input.consume('pause')) this.recordsPanel.close(); else this.recordsPanel.navigate(menuInput);
    } else if (this.controllerPanel.open) {
      this.input.consume('pause'); this.controllerPanel.navigate(menuInput);
    } else if (this.input.consume('pause')) {
      if (this.mode === 'title') this.start(); else if (this.mode === 'result') this.continueResult(); else this.setPaused(this.mode === 'playing');
    } else if (this.mode !== 'playing') {
      this.ui.navigatePad(menuInput);
    }
    if (this.input.consume('mute')) this.toggleMute();
    if (this.input.consume('restart') && this.mode !== 'title') this.restart();
    if (this.input.consume('diagnostics')) this.ui.toggleDiagnostics();

    let alpha = 0;
    if (this.mode === 'playing') {
      alpha = this.clock.advance(elapsed, dt => {
        // Consume one-shot actions only when a simulation step actually runs.
        const input = { ...this.input.flight(), view: { centerX: this.graphics.rig.x, width: this.graphics.viewWidth } };
        const before = this.simulation.state.shotsFired;
        this.simulation.update(dt, input);
        if (this.simulation.state.shotsFired > before) this.audio.pulse();
      }, DIFFICULTIES[this.preferences.difficulty].speed);
    } else this.clock.reset();
    const state = this.simulation.state;
    const teleport = state.events.find(e => e.id > this.lastTeleport && (e.kind === 'portal' || e.kind === 'respawn'));
    if (teleport) { this.lastTeleport = teleport.id; this.graphics.reset(state, false); }
    if (state.enabled && state.outcome !== 'active' && this.mode === 'playing') {
      this.saveRecord();
      const rank = this.run ? this.records.list(this.run?.spawnMode, this.run?.missionMode, this.run?.rescueProtocol, this.run?.vehicleId).findIndex(record => record.id === this.run!.id) + 1 : 0;
      this.ui.recordStatus(this.run && state.score === 0 ? 'Sin puntos registrados. ¡Inténtalo otra vez!' : this.run
        ? `${this.run.pilot} · ${rank ? `Puesto ${rank}/10 · ${this.records.persistent ? 'Guardado' : 'Solo esta sesión'}` : 'Fuera del top 10'} · ${DIFFICULTIES[this.run.difficulty].label} (mínima usada)`
        : 'Práctica de diagnóstico · no registra récords');
      this.setMode('result');
    }
    this.audio.events(state.events, state.player.x);
    this.audio.update(state.player.thrust, Math.abs(state.player.vx), this.mode === 'playing' && state.player.alive, state.vehicleId);
    try {
      this.graphics.draw(state, alpha, elapsed, this.mode === 'playing', this.mode === 'title', this.preferences.reducedMotion);
      this.ui.update(state, this.graphics.metrics(), this.input.gamepadConnected, this.preferences.difficulty, this.input.controller.labels());
    } catch (error) {
      this.showError(error);
      return;
    }
    if (!this.failed) this.raf = requestAnimationFrame(this.frame);
  };

  private unlockAudio(): void {
    void this.audio.unlock().then(() => { this.audioError = null; }).catch(error => {
      this.audioError = error instanceof Error ? error.message : String(error);
    });
  }

  private setMode(mode: AppMode): void {
    this.mode = mode;
    this.clock.reset();
    this.input.clear();
    this.ui.mode(mode);
    if (mode === 'playing') this.canvas.focus({ preventScroll: true });
  }

  start(): void {
    this.saveRecord();
    this.run = { id: crypto.randomUUID(), pilot: this.records.pilot, difficulty: this.preferences.difficulty,
      missionMode: this.preferences.missionMode, spawnMode: this.preferences.spawnMode,
      rescueProtocol: this.preferences.rescueProtocol, vehicleId: this.selectedVehicle, date: new Date().toISOString() };
    this.unlockAudio();
    this.simulation = new Simulation(this.simulation.state.seed,
      this.preferences.spawnMode === 'dynamic' ? 'dynamic-basic' : 'combat-basic',
      this.preferences.difficulty, this.preferences.missionMode, this.preferences.spawnMode, this.preferences.rescueProtocol, this.selectedVehicle);
    this.audio.resetEvents(); this.lastTeleport = 0;
    this.graphics.reset(this.simulation.state, false);
    this.setMode('playing');
  }

  restart(): void {
    if (this.simulation.state.enabled) { this.start(); return; }
    this.simulation = new Simulation(this.simulation.state.seed, this.simulation.state.enabled ? (this.preferences.spawnMode === 'dynamic' ? 'dynamic-basic' : 'combat-basic') : 'flight-basic', this.preferences.difficulty, this.preferences.missionMode, 'classic', this.preferences.rescueProtocol, this.selectedVehicle);
    this.audio.resetEvents(); this.lastTeleport = 0;
    this.graphics.reset(this.simulation.state, false);
    this.setMode('playing');
  }

  menu(): void {
    this.saveRecord(); this.run = null;
    this.simulation = new Simulation(this.simulation.state.seed, 'flight-basic', this.preferences.difficulty, this.preferences.missionMode, 'classic', this.preferences.rescueProtocol, this.selectedVehicle);
    this.audio.resetEvents(); this.lastTeleport = 0;
    this.graphics.reset(this.simulation.state, true);
    this.setMode('title');
  }

  setPaused(value: boolean): void {
    if (this.mode !== 'playing' && this.mode !== 'paused') return;
    this.setMode(value ? 'paused' : 'playing');
    if (!value) this.unlockAudio();
  }

  private selectVehicle(selected: VehicleId): void {
    // Vehicle choice is immutable for an active run and its leaderboard.
    if (this.mode !== 'title') return;
    const vehicle = vehicleProfile(selected).id;
    this.selectedVehicle = vehicle;
    try { localStorage.setItem(VEHICLE_SETTINGS_KEY, vehicle); } catch { /* Session-only selection. */ }
    this.simulation = new Simulation(this.simulation.state.seed, 'flight-basic',
      this.preferences.difficulty, this.preferences.missionMode, 'classic', this.preferences.rescueProtocol, vehicle);
    this.graphics.reset(this.simulation.state, true);
  }

  private toggleMute(): void {
    this.savePreferences({ ...this.preferences, muted: !this.preferences.muted });
    if (!this.preferences.muted && this.mode !== 'title') this.unlockAudio();
  }

  private openLandscape(): void {
    if (this.mode === 'playing') this.setPaused(true);
    this.landscapePanel.show();
  }

  private saveLandscape(preferences: LandscapePreferences): void {
    this.landscapePreferences = sanitizeLandscapePreferences(preferences);
    this.graphics.setLandscape(this.landscapePreferences, this.simulation.state.wave);
    this.ui.setLandscapeTheme(resolveLandscape(this.landscapePreferences, this.simulation.state.wave, this.simulation.state.seed).style);
    try { localStorage.setItem(LANDSCAPE_SETTINGS_KEY, JSON.stringify(this.landscapePreferences)); }
    catch { /* Visual settings remain usable for the current session. */ }
  }

  private savePreferences(preferences: Preferences): void {
    if (this.run && DIFFICULTIES[preferences.difficulty].rank < DIFFICULTIES[this.run.difficulty].rank) {
      this.run.difficulty = preferences.difficulty;
      this.saveRecord();
    }
    // Rescue protocol is a start-of-run decision: pause settings cannot alter ranking or physics mid-flight.
    this.preferences = { ...preferences, rescueProtocol: this.run?.rescueProtocol ?? preferences.rescueProtocol,
      enginePitchHz: normalizeEnginePitch(preferences.enginePitchHz) };
    this.simulation.setDifficulty(preferences.difficulty);
    this.simulation.setMissionMode(preferences.missionMode);
    // Spawn type belongs to the run and can only be chosen on the title screen.
    this.audio.setMuted(preferences.muted);
    this.audio.setVolume(preferences.volume);
    this.audio.setEnginePitch(this.preferences.enginePitchHz);
    this.ui.syncMuted(preferences.muted);
    try { localStorage.setItem(GAME_SETTINGS_KEY, JSON.stringify(this.preferences)); } catch { /* Session settings still work without storage. */ }
  }

  private async fullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector<HTMLElement>('#app')?.requestFullscreen();
    } catch { /* Browser may deny fullscreen; the fitted viewport remains usable. */ }
  }

  private onBlur = (): void => { if (this.mode === 'playing') this.setPaused(true); };
  private onVisibility = (): void => { if (document.hidden) this.onBlur(); };
  private onPageHide = (): void => { this.saveRecord(); };

  private saveRecord(): void {
    if (!this.run) return;
    this.records.save({ ...this.run, score: this.simulation.state.score, wave: this.simulation.state.wave });
  }

  private continueResult(): void {
    if (this.simulation.nextWave()) {
      this.unlockAudio(); this.audio.resetEvents(); this.lastTeleport = 0;
      this.graphics.reset(this.simulation.state, false);
      this.ui.setLandscapeTheme(resolveLandscape(this.landscapePreferences, this.simulation.state.wave, this.simulation.state.seed).style);
      this.setMode('playing');
    } else this.restart();
  }

  private diagnostics() {
    return Object.freeze({
      getState: () => ({ ...this.simulation.snapshot(), mode: this.mode, preferences: { ...this.preferences },
        landscape: sanitizeLandscapePreferences(this.landscapePreferences),
        camera: { x: this.graphics.rig.x, viewWidth: this.graphics.viewWidth,
          radarSegments: radarSegments(this.graphics.rig.x, this.graphics.viewWidth, CONFIG.worldWidth) },
        audio: this.audio.getState() }),
      loadScenario: (name: string, seed = this.simulation.state.seed, vehicle: VehicleId = 'ship') => {
        if (!(SCENARIOS as readonly string[]).includes(name)) throw new Error(`Escenario no implementado: ${name}. Disponibles: ${SCENARIOS.join(', ')}`);
        if (!Number.isFinite(seed)) throw new Error('La semilla debe ser finita.');
        if (vehicle !== 'ship' && vehicle !== 'helicopter') throw new Error('Vehículo no implementado.');
        // DEV-only diagnostic, never a production choice or ranked run.
        this.run = null;
        this.simulation = new Simulation(seed, name as ScenarioName, this.preferences.difficulty, this.preferences.missionMode, 'classic', this.preferences.rescueProtocol, vehicle);
        this.audio.resetEvents(); this.lastTeleport = 0;
        this.graphics.reset(this.simulation.state, false);
        this.setMode('playing');
      },
      setPaused: (value: boolean) => this.setPaused(value),
      step: (frames: number) => {
        if (this.mode !== 'paused') throw new Error('Pausa la simulación antes de avanzar por cuadros.');
        if (!Number.isInteger(frames) || frames < 0 || frames > 3600) throw new Error('frames debe ser un entero entre 0 y 3600.');
        this.run = null;
        for (let i = 0; i < frames; i++) this.simulation.update(this.clock.dt, IDLE_INPUT);
      },
      getMetrics: () => ({ ...this.graphics.metrics(), seed: this.simulation.state.seed,
        landscape: resolveLandscape(this.landscapePreferences, this.simulation.state.wave, this.simulation.state.seed).name,
        scenario: this.simulation.state.scenario, simulationHz: 60, frame: this.simulation.state.frame,
        entities: { player: Number(this.simulation.state.player.alive), enemies: this.simulation.state.enemies.length,
          colonists: this.simulation.state.colonists.filter(c => c.status !== 'lost').length, projectiles: this.simulation.state.shots.length,
          particles: this.graphics.combat.particleCount },
        wave: { number: this.simulation.state.wave, pressure: wavePressure(this.simulation.state.wave), ranked: Boolean(this.run), outcome: this.simulation.state.outcome, score: this.simulation.state.score, delivered: this.simulation.state.delivered,
          remainingSpawns: this.simulation.state.spawnMode === 'dynamic' ? null : this.simulation.state.schedule.length - this.simulation.state.spawnIndex,
          spawnMode: this.simulation.state.spawnMode, dynamicSpawned: this.simulation.state.director?.spawned ?? 0 },
        difficulty: this.preferences.difficulty, rescueProtocol: this.simulation.state.rescueProtocol,
        speed: DIFFICULTIES[this.preferences.difficulty].speed,
        difficultyProfile: { ...DIFFICULTIES[this.preferences.difficulty] },
        controller: this.input.controller.snapshot(), droppedSeconds: this.clock.droppedSeconds, audioError: this.audioError }),
      restart: () => this.restart(),
      listScenarios: () => [...SCENARIOS],
    });
  }

  showError(error: unknown): void {
    if (this.failed || this.disposed) return;
    this.failed = true;
    cancelAnimationFrame(this.raf);
    this.audio.update(0, 0, false);
    const message = error instanceof Error ? error.message : String(error);
    const panel = document.querySelector<HTMLDivElement>('#loading') ?? document.createElement('div');
    panel.id = 'loading'; panel.setAttribute('role', 'alert');
    panel.textContent = `No se pudo continuar el vuelo: ${message}`;
    const fallback = document.createElement('a');
    const url = new URL(location.href);
    url.searchParams.set('backend', 'webgl2');
    fallback.href = url.href;
    fallback.textContent = 'Reiniciar con WebGL2';
    panel.append(fallback);
    document.querySelector('#viewport')?.append(panel);
    console.error(error);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.input.dispose(); this.audio.dispose(); this.graphics.dispose();
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    delete window.__VOID_RESCUE__;
  }
}

export type DebugApi = ReturnType<GameApp['diagnostics']>;
declare global { interface Window { __VOID_RESCUE__?: DebugApi } }
