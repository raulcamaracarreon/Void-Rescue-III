/** Procedural helicopter engine, separate from the legacy spacecraft audio.
 * A pulsed, filtered rotor wash and a low turbine drone; no external samples,
 * AudioWorklets, frame allocations or changes to the deterministic simulation.
 */
export interface HelicopterSoundProfile {
  rotorHz: number;
  turbineHz: number;
  rotorGain: number;
  pulseDepth: number;
  turbineGain: number;
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}

/** Rotor beats persist while hovering, unlike the ship's speed-based whine. */
export function helicopterSoundProfile(speed: number, thrust: number): HelicopterSoundProfile {
  const v = clamp(speed, 0, 90) / 90;
  const t = clamp(thrust, 0, 1);
  const rotorGain = 0.055 + v * 0.015 + t * 0.012;
  return {
    rotorHz: 17 + v * 1.8 + t * 0.8,
    turbineHz: 82 + v * 11 + t * 8,
    rotorGain,
    pulseDepth: rotorGain * 0.84,
    turbineGain: 0.024 + v * 0.008 + t * 0.01,
  };
}

/** Owns its continuous sources; update only changes AudioParam automation.
 * Connect to the same master bus as the ship for mute/volume integration.
 */
export class HelicopterSound {
  private readonly rotor: AudioBufferSourceNode;
  private readonly pulse: OscillatorNode;
  private readonly turbine: OscillatorNode;
  private readonly rotorGain: GainNode;
  private readonly pulseDepth: GainNode;
  private readonly turbineGain: GainNode;

  constructor(private readonly context: AudioContext, master: GainNode) {
    // Repeatable broadband rotor wash, band-limited downstream. Synthesized
    // once, not per animation frame; it is intentionally not a sampled sound.
    const buffer = context.createBuffer(1, Math.max(1, Math.round(context.sampleRate)), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 0x5eeda41;
    for (let i = 0; i < samples.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      samples[i] = (seed >>> 0) / 2147483648 - 1;
    }

    this.rotor = context.createBufferSource();
    this.rotor.buffer = buffer;
    this.rotor.loop = true;
    const rotorFilter = context.createBiquadFilter();
    rotorFilter.type = 'lowpass';
    rotorFilter.frequency.value = 460;
    rotorFilter.Q.value = 0.7;
    this.rotorGain = context.createGain();
    this.rotorGain.gain.value = 0;
    this.rotor.connect(rotorFilter).connect(this.rotorGain).connect(master);

    // Four-blade rotor: pulsed amplitude modulation, not a generic whine.
    this.pulse = context.createOscillator();
    this.pulse.type = 'sine';
    this.pulse.frequency.value = 17;
    this.pulseDepth = context.createGain();
    this.pulseDepth.gain.value = 0;
    this.pulse.connect(this.pulseDepth).connect(this.rotorGain.gain);

    this.turbine = context.createOscillator();
    this.turbine.type = 'sawtooth';
    this.turbine.frequency.value = 82;
    const turbineFilter = context.createBiquadFilter();
    turbineFilter.type = 'lowpass';
    turbineFilter.frequency.value = 280;
    turbineFilter.Q.value = 0.5;
    this.turbineGain = context.createGain();
    this.turbineGain.gain.value = 0;
    this.turbine.connect(turbineFilter).connect(this.turbineGain).connect(master);

    this.rotor.start();
    this.pulse.start();
    this.turbine.start();
  }

  update(thrust: number, speed: number, active: boolean): void {
    const now = this.context.currentTime;
    const profile = helicopterSoundProfile(speed, thrust);
    this.pulse.frequency.setTargetAtTime(profile.rotorHz, now, 0.12);
    this.turbine.frequency.setTargetAtTime(profile.turbineHz, now, 0.09);
    this.rotorGain.gain.setTargetAtTime(active ? profile.rotorGain : 0, now, 0.045);
    this.pulseDepth.gain.setTargetAtTime(active ? profile.pulseDepth : 0, now, 0.045);
    this.turbineGain.gain.setTargetAtTime(active ? profile.turbineGain : 0, now, 0.06);
  }

  dispose(): void {
    this.rotor.stop();
    this.pulse.stop();
    this.turbine.stop();
    this.rotor.disconnect();
    this.pulse.disconnect();
    this.turbine.disconnect();
    this.rotorGain.disconnect();
    this.pulseDepth.disconnect();
    this.turbineGain.disconnect();
  }
}
