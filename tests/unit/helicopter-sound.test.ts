import { describe, expect, it } from 'vitest';
import { HelicopterSound, helicopterSoundProfile } from '../../src/audio/HelicopterSound';

describe('fase 4 — audio diferenciado del helicóptero', () => {
  it('mantiene pulsos de rotor al estar suspendido en vuelo estacionario', () => {
    const hover = helicopterSoundProfile(0, 0);
    expect(hover.rotorHz).toBeGreaterThan(15);
    expect(hover.rotorGain).toBeGreaterThan(0);
    expect(hover.pulseDepth).toBeLessThan(hover.rotorGain);
    expect(hover.turbineHz).toBeGreaterThan(60);
  });

  it('incrementa moderadamente la intensidad de las palas y turbina con velocidad/empuje', () => {
    const hover = helicopterSoundProfile(0, 0);
    const cruise = helicopterSoundProfile(80, 1);
    expect(cruise.rotorHz).toBeGreaterThan(hover.rotorHz);
    expect(cruise.turbineHz).toBeGreaterThan(hover.turbineHz);
    expect(cruise.rotorGain).toBeGreaterThan(hover.rotorGain);
    expect(cruise.turbineGain).toBeGreaterThan(hover.turbineGain);
    expect(cruise.rotorHz).toBeLessThan(22);
  });

  it('acota los parámetros ante entradas extremas o no finitas', () => {
    expect(helicopterSoundProfile(Infinity, NaN)).toEqual(helicopterSoundProfile(0, 0));
    expect(helicopterSoundProfile(-100, -1)).toEqual(helicopterSoundProfile(0, 0));
    expect(helicopterSoundProfile(99999, 99)).toEqual(helicopterSoundProfile(90, 1));
  });

  it('enciende y apaga las tres fuentes por ganancias y las libera sin recrearlas cada frame', () => {
    class FakeParam {
      value = 0;
      setTargetAtTime(value: number): void { this.value = value; }
    }
    class FakeNode {
      readonly gain = new FakeParam();
      readonly frequency = new FakeParam();
      readonly Q = new FakeParam();
      type = '';
      buffer: unknown = null;
      loop = false;
      started = 0;
      stopped = 0;
      disconnected = 0;
      connect(): this { return this; }
      start(): void { this.started++; }
      stop(): void { this.stopped++; }
      disconnect(): void { this.disconnected++; }
    }
    const gains: FakeNode[] = [];
    const sources: FakeNode[] = [];
    const ctx = {
      sampleRate: 1000,
      currentTime: 42,
      createBuffer: () => ({ getChannelData: () => new Float32Array(1000) }),
      createBufferSource: () => { const node = new FakeNode(); sources.push(node); return node; },
      createOscillator: () => { const node = new FakeNode(); sources.push(node); return node; },
      createBiquadFilter: () => new FakeNode(),
      createGain: () => { const node = new FakeNode(); gains.push(node); return node; },
    };
    const sound = new HelicopterSound(ctx as unknown as AudioContext, new FakeNode() as unknown as GainNode);
    expect(sources).toHaveLength(3);
    expect(sources.every(node => node.started === 1)).toBe(true);
    sound.update(1, 90, true);
    expect(gains).toHaveLength(3);
    expect(gains.every(node => node.gain.value > 0)).toBe(true);
    expect(sources[1]!.frequency.value).toBeGreaterThan(17); // rotor pulse
    sound.update(0, 0, false);
    expect(gains.map(node => node.gain.value)).toEqual([0, 0, 0]);
    sound.update(1, 25, true);
    expect(sources).toHaveLength(3);
    sound.dispose();
    expect(sources.every(node => node.stopped === 1 && node.disconnected === 1)).toBe(true);
  });
});
