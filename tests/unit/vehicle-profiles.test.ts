import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/game/config';
import { Simulation } from '../../src/game/Simulation';
import { Terrain } from '../../src/game/Terrain';
import { HELICOPTER_PROFILE, SHIP_PROFILE, vehicleProfile } from '../../src/game/VehicleProfile';

const dt = 1 / 60;
const idle = { x: 0, y: 0, fire: false } as const;

describe('fase 4 — perfiles de vehículo', () => {
  it('mantiene la nave heredada como predeterminada y reproduce las constantes originales', () => {
    const ship = vehicleProfile();
    expect(ship).toBe(SHIP_PROFILE);
    expect(ship.flight).toEqual({
      acceleration: CONFIG.acceleration,
      drag: CONFIG.drag,
      maxSpeed: CONFIG.maxSpeed,
      verticalSpeed: CONFIG.verticalSpeed,
      verticalResponse: CONFIG.verticalResponse,
      groundClearance: 0,
    });
    expect(ship.weapon).toEqual({ projectileSpeed: CONFIG.shotSpeed, muzzleOffset: 5 });
    const defaultSim = new Simulation(42);
    const explicitShip = new Simulation(42, 'flight-basic', 'normal', 'defense', 'classic', 'realistic', 'ship');
    for (let i = 0; i < 120; i++) {
      const input = { x: i < 80 ? 1 : -1, y: i < 40 ? 1 : i < 80 ? -1 : 0, fire: i % 7 === 0 };
      defaultSim.update(dt, input);
      explicitShip.update(dt, input);
    }
    expect(defaultSim.snapshot()).toEqual(explicitShip.snapshot());
    expect(defaultSim.state.vehicleId).toBe('ship');
    expect(defaultSim.vehicle).toBe(SHIP_PROFILE);
  });

  it('calcula el primer paso del modelo nave con la fórmula anterior exactamente', () => {
    const sim = new Simulation(8042);
    sim.update(dt, { x: 1, y: 1, fire: true });
    const expectedVx = Math.min(CONFIG.maxSpeed,
      CONFIG.acceleration * dt * Math.exp(-CONFIG.drag * dt));
    const expectedVy = CONFIG.verticalSpeed * (1 - Math.exp(-CONFIG.verticalResponse * dt));
    expect(sim.state.player.vx).toBe(expectedVx);
    expect(sim.state.player.vy).toBe(expectedVy);
    // The ship advances before firing, and the flight-basic scenario advances
    // the newly spawned projectile once again during the SAME simulation tick.
    const expectedShotVx = CONFIG.shotSpeed + expectedVx;
    const spawnX = CONFIG.startX + expectedVx * dt + SHIP_PROFILE.weapon.muzzleOffset;
    expect(sim.state.shots[0]?.vx).toBe(expectedShotVx);
    expect(sim.state.shots[0]?.x).toBeCloseTo(spawnX + expectedShotVx * dt, 10);
  });

  it('define un helicóptero experimental de movimiento distinto, sin cambiar reglas de rescate', () => {
    const ship = new Simulation(42);
    const helicopter = new Simulation(42, 'flight-basic', 'normal', 'defense', 'classic', 'realistic', 'helicopter');
    expect(helicopter.vehicle).toBe(HELICOPTER_PROFILE);
    expect(helicopter.state.vehicleId).toBe('helicopter');
    expect(helicopter.state.missionMode).toBe(ship.state.missionMode);
    expect(helicopter.state.rescueProtocol).toBe(ship.state.rescueProtocol);
    for (let i = 0; i < 180; i++) {
      const input = { x: 1, y: 1, fire: false };
      ship.update(dt, input);
      helicopter.update(dt, input);
    }
    expect(helicopter.state.player.vx).toBeGreaterThan(ship.state.player.vx);
    expect(helicopter.state.player.vx).toBeGreaterThan(80);
    expect(helicopter.state.player.vx).toBeLessThanOrEqual(HELICOPTER_PROFILE.flight.maxSpeed);
    expect(helicopter.state.player.y).toBeLessThanOrEqual(CONFIG.maxAltitude);
    expect(helicopter.state.player.x).not.toBe(ship.state.player.x);
    for (let i = 0; i < 300; i++) helicopter.update(dt, idle);
    expect(Math.abs(helicopter.state.player.vx)).toBeLessThan(1);
  });

  it('permite al helicóptero llegar al suelo en reconocimiento sin romper el límite antiguo de la nave', () => {
    const seed = 8042;
    const ship = new Simulation(seed);
    const helicopter = new Simulation(seed, 'flight-basic', 'normal', 'defense', 'classic', 'realistic', 'helicopter');
    const floor = new Terrain(seed).height(CONFIG.startX) + HELICOPTER_PROFILE.flight.groundClearance;
    expect(floor).toBeLessThan(CONFIG.minAltitude);
    for (let i = 0; i < 220; i++) {
      const descend = { x: 0, y: -1, fire: false };
      ship.update(dt, descend);
      helicopter.update(dt, descend);
    }
    expect(ship.state.player.y).toBe(CONFIG.minAltitude);
    expect(helicopter.state.player.y).toBeCloseTo(floor, 9);
    expect(helicopter.state.player.vy).toBe(0);
  });

  it('mantiene separación del terreno al volar rápido y al cruzar la costura', () => {
    const seed = 17;
    const sim = new Simulation(seed, 'world-seam', 'normal', 'defense', 'classic', 'realistic', 'helicopter');
    const terrain = new Terrain(seed);
    sim.state.player.y = terrain.height(sim.state.player.x) + 8;
    sim.state.player.previousY = sim.state.player.y;
    for (let i = 0; i < 280; i++) {
      sim.update(dt, { x: 1, y: -1, fire: false });
      expect(sim.state.player.y).toBeGreaterThanOrEqual(
        terrain.height(sim.state.player.x) + HELICOPTER_PROFILE.flight.groundClearance - 1e-9);
      expect(sim.state.player.y).toBeLessThanOrEqual(CONFIG.maxAltitude);
    }
    expect(sim.state.laps).toBeGreaterThanOrEqual(1);
  });

  it('preserva determinismo con la variante experimental, sin modificar nave ni puntuación', () => {
    const a = new Simulation(17, 'flight-basic', 'normal', 'defense', 'classic', 'realistic', 'helicopter');
    const b = new Simulation(17, 'flight-basic', 'normal', 'defense', 'classic', 'realistic', 'helicopter');
    for (let i = 0; i < 180; i++) {
      const input = { x: i % 30 < 18 ? 1 : -1, y: i % 20 < 10 ? 1 : -1, fire: i % 5 === 0 };
      a.update(dt, input);
      b.update(dt, input);
    }
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.state.score).toBe(0);
    expect(a.state.shotsFired).toBe(b.state.shotsFired);
    expect(vehicleProfile('ship').id).toBe('ship');
  });
});
