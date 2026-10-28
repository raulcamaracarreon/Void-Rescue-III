import { describe, expect, it } from 'vitest';
import { animateHelicopter, createHelicopter } from '../../src/render/models/Helicopter';

describe('fase 4 — modelo visual del helicóptero', () => {
  it('construye un helicóptero 2.5D con cabina, cola, patines y rotores', () => {
    const model = createHelicopter();
    expect(model.group.name).toBe('vehicle-helicopter');
    expect(model.group.getObjectByName('cabin')).toBeDefined();
    expect(model.group.getObjectByName('cockpit')).toBeDefined();
    expect(model.group.getObjectByName('tail-boom')).toBeDefined();
    expect(model.group.children.filter(node => node.name === 'landing-skid')).toHaveLength(2);
    expect(model.group.getObjectByName('main-rotor')).toBe(model.mainRotor);
    expect(model.group.getObjectByName('tail-rotor')).toBe(model.tailRotor);
    expect(model.mainRotor.children).toHaveLength(2);
    expect(model.tailRotor.children).toHaveLength(3);
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
