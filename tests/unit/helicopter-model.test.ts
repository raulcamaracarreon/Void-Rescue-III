import { describe, expect, it } from 'vitest';
import { animateHelicopter, createHelicopter, helicopterAttitude } from '../../src/render/models/Helicopter';

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

  it('inclina el morro arriba al ascender y abajo al descender en ambos sentidos', () => {
    for (const facing of [1, -1] as const) {
      const rising = helicopterAttitude(0, 25, facing, false);
      const falling = helicopterAttitude(0, -25, facing, false);
      // World Y of a +X nose: mirrored nose X multiplied by the Z rotation.
      expect(Math.sin(rising.pitchZ) * facing).toBeGreaterThan(0);
      expect(Math.sin(falling.pitchZ) * facing).toBeLessThan(0);
      expect(rising.pitchZ).toBeCloseTo(-falling.pitchZ, 10);
      expect(helicopterAttitude(0, 0, facing, false).pitchZ).toBe(0);
    }
  });

  it('limita la inclinación a valores arcade legibles y respeta movimiento reducido', () => {
    const max = helicopterAttitude(500, 500, 1, false);
    expect(max.pitchZ).toBeCloseTo(0.22, 10);
    expect(max.bankX).toBeCloseTo(-0.14, 10);
    const min = helicopterAttitude(-500, -500, -1, false);
    expect(min.pitchZ).toBeCloseTo(0.22, 10); // mirrored when facing left
    expect(min.bankX).toBeCloseTo(0.14, 10);
    expect(helicopterAttitude(90, -42, -1, true)).toEqual({ bankX: 0, pitchZ: 0 });
    expect(helicopterAttitude(NaN, Infinity, 1, false)).toEqual({ bankX: 0, pitchZ: 0 });
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
