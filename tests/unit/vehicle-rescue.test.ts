import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/game/Simulation';
import { Terrain } from '../../src/game/Terrain';
import { COMBAT } from '../../src/game/combat/types';
import { startPlayerExtraction } from '../../src/game/combat/ColonistSystem';
import { HELICOPTER_PROFILE, SHIP_PROFILE } from '../../src/game/VehicleProfile';
import { SAFE_BASE } from '../../src/game/config';

const dt = 1 / 60;
const idle = { x: 0, y: 0, fire: false } as const;
const holding = { ...idle, portal: true } as const;

function rescue(vehicle: 'ship' | 'helicopter') {
  return new Simulation(8042, 'rescue-pickup', 'normal', 'rescue', 'classic', 'realistic', vehicle);
}

describe('fase 4 — rescate por tipo de vehículo', () => {
  it('conserva parámetros exactos de extracción y entrega de la nave original', () => {
    expect(SHIP_PROFILE.rescue).toEqual({
      capacity: null, pickupRange: 8, minPickupHeight: 3, maxPickupHeight: 17,
      maxPickupSpeed: null, extractionSpeed: COMBAT.extractionSpeed,
      extractionHorizontalSpeed: COMBAT.extractionHorizontalSpeed,
      deliverySpeed: COMBAT.deliverySpeed,
    });
  });

  it('recoge a baja altura y aloja pasajeros en la cabina del helicóptero', () => {
    const sim = rescue('helicopter');
    const target = sim.state.colonists[0]!;
    expect(sim.state.player.y - target.y).toBeCloseTo(9);
    for (let i = 0; i < 90 && target.status !== 'carried'; i++) sim.update(dt, holding);
    expect(target.status).toBe('carried');
    expect(target.onboard).toBe(true);
    expect(sim.state.score).toBe(COMBAT.catchPoints);
    expect(sim.state.colonists.filter(c => c.status === 'carried')).toHaveLength(1);
  });

  it('rechaza recogidas demasiado rápidas o demasiado altas en el helicóptero', () => {
    const sim = rescue('helicopter');
    const target = sim.state.colonists[0]!;
    sim.state.player.y = target.y + 16;
    expect(startPlayerExtraction(sim.context)).toBe(false);
    sim.state.player.y = target.y + 7;
    sim.state.player.vx = 28;
    expect(startPlayerExtraction(sim.context)).toBe(false);
    sim.state.player.vx = 0;
    expect(startPlayerExtraction(sim.context)).toBe(true);
  });

  it('limita el helicóptero a dos pasajeros y obliga a entregar antes de continuar', () => {
    const sim = rescue('helicopter');
    const [first, second, third] = sim.state.colonists;
    first!.status = 'carried'; first!.onboard = true;
    second!.status = 'carried'; second!.onboard = true;
    third!.status = 'ground'; third!.owner = null;
    third!.x = third!.homeX = sim.state.player.x;
    third!.y = new Terrain(sim.state.seed).height(third!.x) + 1.5;
    third!.walkDirection = 0;
    expect(HELICOPTER_PROFILE.rescue.capacity).toBe(2);
    expect(startPlayerExtraction(sim.context)).toBe(false);
    sim.update(dt, holding);
    expect(third!.status).toBe('ground');

    // Evacuation mode only delivers near Fortaleza 01, at low speed/altitude.
    const terrain = new Terrain(sim.state.seed);
    sim.state.player.x = sim.state.player.previousX = SAFE_BASE.x;
    sim.state.player.y = sim.state.player.previousY =
      terrain.height(SAFE_BASE.x) + HELICOPTER_PROFILE.flight.groundClearance;
    sim.state.player.vx = sim.state.player.vy = 0;
    sim.update(dt, idle);
    expect(first!.status).toBe('safe');
    expect(second!.status).toBe('safe');
    expect(sim.state.delivered).toBe(2);
    expect(sim.state.score).toBeGreaterThan(0);

    // Boarding the next colonist becomes available only after unloading.
    sim.state.player.x = sim.state.player.previousX = third!.x;
    sim.state.player.y = sim.state.player.previousY = third!.y + 7;
    sim.state.player.vx = sim.state.player.vy = 0;
    expect(startPlayerExtraction(sim.context)).toBe(true);
  });

  it('mantiene la extracción tradicional de la nave sin límite de dos pasajeros', () => {
    const sim = rescue('ship');
    const [first, second, third] = sim.state.colonists;
    first!.status = 'carried';
    second!.status = 'carried';
    third!.status = 'ground'; third!.owner = null;
    third!.x = third!.homeX = sim.state.player.x;
    third!.y = new Terrain(sim.state.seed).height(third!.x) + 1.5;
    third!.walkDirection = 0;
    sim.state.player.y = third!.y + 9;
    expect(startPlayerExtraction(sim.context)).toBe(true);
  });

  it('interrumpe la recogida del helicóptero si acelera y conserva el régimen de caída', () => {
    const sim = rescue('helicopter');
    const target = sim.state.colonists[0]!;
    sim.update(dt, holding);
    expect(target.status).toBe('extracting');
    sim.state.player.vx = 35;
    sim.update(dt, holding);
    expect(target.status).toBe('falling');
  });
});
