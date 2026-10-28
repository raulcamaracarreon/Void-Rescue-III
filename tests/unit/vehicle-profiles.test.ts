import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/game/config';
import { Simulation } from '../../src/game/Simulation';
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
    expect(sim.state.shots[0]?.x).toBe(CONFIG.startX + 5);
    expect(sim.state.shots[0]?.vx).toBe(CONFIG.shotSpeed + expectedVx);
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
    expect(ship.state.player.vx).toBeGreaterThan(helicopter.state.player.vx);
    expect(helicopter.state.player.vx).toBeLessThanOrEqual(HELICOPTER_PROFILE.flight.maxSpeed);
    expect(helicopter.state.player.y).toBeLessThanOrEqual(CONFIG.maxAltitude);
    expect(helicopter.state.player.x).not.toBe(ship.state.player.x);
    for (let i = 0; i < 300; i++) helicopter.update(dt, idle);
    expect(Math.abs(helicopter.state.player.vx)).toBeLessThan(1);
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
