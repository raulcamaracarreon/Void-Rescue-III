import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three/webgpu';
import { HELICOPTER_PROFILE, SHIP_PROFILE } from '../../src/game/VehicleProfile';
import { createShip } from '../../src/render/models/Ship';
import { animateHelicopter, createHelicopter, HELICOPTER_GAME_SCALE } from '../../src/render/models/Helicopter';

describe('fase 4 — modelo visual del helicóptero', () => {
  it('construye un helicóptero utilitario angular con cabina, motores, ruedas y rotores', () => {
    const model = createHelicopter();
    expect(model.group.name).toBe('vehicle-helicopter');
    expect(model.group.getObjectByName('cabin')).toBeDefined();
    expect(model.group.getObjectByName('cockpit')).toBeDefined();
    expect(model.group.getObjectByName('tail-boom')).toBeDefined();
    expect(model.group.children.filter(node => node.name === 'landing-wheel')).toHaveLength(2);
    expect(model.group.children.filter(node => node.name === 'turbine-engine')).toHaveLength(2);
    expect(model.group.getObjectByName('sliding-door')).toBeDefined();
    expect(model.group.getObjectByName('tail-fin')).toBeDefined();
    expect(model.group.getObjectByName('main-rotor')).toBe(model.mainRotor);
    expect(model.group.getObjectByName('tail-rotor')).toBe(model.tailRotor);
    expect(model.mainRotor.children).toHaveLength(3);
    expect(model.tailRotor.children).toHaveLength(3);
  });

  it('mantiene un perfil lateral más grande que el prototipo de juguete', () => {
    const model = createHelicopter();
    model.group.updateMatrixWorld(true);
    const wheel = model.group.getObjectByName('landing-wheel')!;
    const boom = model.group.getObjectByName('tail-boom')!;
    const cabin = model.group.getObjectByName('cabin')!;
    expect(wheel.position.y).toBeLessThan(-2);
    expect(boom).toBeDefined();
    expect(cabin).toBeDefined();
    expect(model.tailRotor.position.x).toBeLessThan(-10);
    expect(model.mainRotor.position.y).toBeGreaterThan(3);
  });

  it('mantiene una huella visible comparable a la nave clásica y las ruedas sobre el suelo', () => {
    const ship = createShip();
    const helicopter = createHelicopter();
    helicopter.group.scale.setScalar(HELICOPTER_GAME_SCALE);
    ship.group.updateMatrixWorld(true);
    helicopter.group.updateMatrixWorld(true);

    const shipBounds = new Box3().setFromObject(ship.group);
    const helicopterBounds = new Box3().setFromObject(helicopter.group);
    const shipSize = shipBounds.getSize(new Vector3());
    const helicopterSize = helicopterBounds.getSize(new Vector3());

    // Same order of size as the classic ship (including its exhaust meshes),
    // rather than the 2x-sized model that was visible in the first prototype.
    expect(helicopterSize.x).toBeGreaterThan(shipSize.x * 0.8);
    expect(helicopterSize.x).toBeLessThan(shipSize.x * 1.15);
    expect(helicopterSize.y).toBeGreaterThan(shipSize.y * 0.75);
    expect(helicopterSize.y).toBeLessThan(shipSize.y * 1.15);

    // The lowest wheels touch near the floor without penetrating the terrain
    // in neutral hover (player center is at terrain + groundClearance).
    const wheelGap = HELICOPTER_PROFILE.flight.groundClearance + helicopterBounds.min.y;
    expect(wheelGap).toBeGreaterThan(0);
    expect(wheelGap).toBeLessThan(0.75);
    expect(SHIP_PROFILE.flight.groundClearance).toBe(0);
    // The shared hitbox/shot rules are unchanged by these visual dimensions.
  });

  it('anima rotores independientemente sin intervenir en la simulación', () => {
    const model = createHelicopter();
    animateHelicopter(model, 1 / 60, false);
    expect(model.mainRotor.rotation.y).toBeGreaterThan(0);
    expect(model.tailRotor.rotation.z).toBeGreaterThan(0);
    const mainBefore = model.mainRotor.rotation.y;
    const tailBefore = model.tailRotor.rotation.z;
    animateHelicopter(model, 1 / 60, true);
    expect(model.mainRotor.rotation.y).toBe(mainBefore);
    expect(model.tailRotor.rotation.z).toBe(tailBefore);
    animateHelicopter(model, 0, false);
    animateHelicopter(model, NaN, false);
    expect(model.mainRotor.rotation.y).toBe(mainBefore);
    expect(model.tailRotor.rotation.z).toBe(tailBefore);
  });

  it('limita saltos de tiempo y mantiene los ángulos de los rotores acotados', () => {
    const model = createHelicopter();
    animateHelicopter(model, 100, false);
    expect(model.mainRotor.rotation.y).toBeCloseTo(2.6);
    expect(model.tailRotor.rotation.z).toBeCloseTo(3.7);
    for (let i = 0; i < 800; i++) animateHelicopter(model, 1 / 60, false);
    expect(model.mainRotor.rotation.y).toBeGreaterThanOrEqual(0);
    expect(model.mainRotor.rotation.y).toBeLessThan(2 * Math.PI);
    expect(model.tailRotor.rotation.z).toBeGreaterThanOrEqual(0);
    expect(model.tailRotor.rotation.z).toBeLessThan(2 * Math.PI);
  });
});
