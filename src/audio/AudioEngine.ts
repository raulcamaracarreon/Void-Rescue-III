import type { GameEvent } from '../game/combat/types';
import { signedWrappedDeltaX } from '../core/WorldWrap';
import { CONFIG } from '../game/config';
import type { VehicleId } from '../game/VehicleProfile';
import { HelicopterSound } from './HelicopterSound';
import { CombatSound, masterBus } from './CombatSound';

/** Frequency selected on the settings slider is the whine at full speed and thrust. */
export const ENGINE_PITCH_MIN = 250;
export const ENGINE_PITCH_MAX = 1000;
export const ENGINE_PITCH_DEFAULT = 300;

export function normalizeEnginePitch(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(Math.max(ENGINE_PITCH_MIN, Math.min(ENGINE_PITCH_MAX, value)))
    : ENGINE_PITCH_DEFAULT;
}

/** Maintain speed/thrust modulation while allowing arbitrary maximum tones. */
export function engineWhineFrequency(speed: number, thrust: number, selectedPitchHz = ENGINE_PITCH_DEFAULT): number {
  const base = 155 + Math.max(0, Math.min(CONFIG.maxSpeed, speed)) * 1.5
    + Math.max(0, Math.min(1, thrust)) * 40;
  return base * normalizeEnginePitch(selectedPitchHz) / ENGINE_PITCH_DEFAULT;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineWhine: OscillatorNode | null = null;
  private engineWhineGain: GainNode | null = null;
  private helicopterSound: HelicopterSound | null = null;
  private currentVehicle: VehicleId = 'ship';
  muted = false;
  volume = 0.45;
  private enginePitchHz = ENGINE_PITCH_DEFAULT;
  private lastEventId = 0;
  private voices = 0;
  private combat: CombatSound | null = null;

  async unlock(): Promise<void> {
    if (!this.context) {
      const context = this.context = new AudioContext();
      const master = this.master = masterBus(context, context.destination);
      this.combat = new CombatSound(context, master);
      const engine = this.engine = context.createOscillator();
      engine.type = 'triangle';
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 115; filter.Q.value = 0.7;
      const gain = this.engineGain = context.createGain();
      gain.gain.value = 0;
      engine.connect(filter).connect(gain).connect(master);
      const whine = this.engineWhine = context.createOscillator();
      whine.type = 'sine';
      const whineFilter = context.createBiquadFilter();
      whineFilter.type = 'lowpass'; whineFilter.frequency.value = 2600;
      const whineGain = this.engineWhineGain = context.createGain();
      whineGain.gain.value = 0;
      whine.connect(whineFilter).connect(whineGain).connect(master);
      engine.start();
      whine.start();
    }
    await this.context.resume();
    this.setVolume(this.volume);
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.025);
  }

  setMuted(value: boolean): void { this.muted = value; this.setVolume(this.volume); }

  setEnginePitch(value: number): void { this.enginePitchHz = normalizeEnginePitch(value); }

  update(thrust: number, speed: number, active: boolean, vehicle: VehicleId = 'ship'): void {
    this.currentVehicle = vehicle;
    if (!this.context || !this.master || !this.engine || !this.engineGain || !this.engineWhine || !this.engineWhineGain) return;
    const now = this.context.currentTime;
    const shipActive = active && vehicle === 'ship';
    // Preserve the original spacecraft frequencies and thrust response exactly.
    this.engine.frequency.setTargetAtTime(48 + speed * 0.18 + thrust * 18, now, 0.06);
    this.engineWhine.frequency.setTargetAtTime(engineWhineFrequency(speed, thrust, this.enginePitchHz), now, 0.045);
    this.engineGain.gain.setTargetAtTime(shipActive ? 0.012 + thrust * 0.032 : 0, now, 0.06);
    this.engineWhineGain.gain.setTargetAtTime(shipActive ? 0.006 + thrust * 0.034 : 0, now, 0.045);

    // The alternative synth starts only when the helicopter is selected.
    // Both vehicles use the existing master bus, mute and volume settings.
    if (vehicle === 'helicopter' && !this.helicopterSound) {
      this.helicopterSound = new HelicopterSound(this.context, this.master);
    }
    this.helicopterSound?.update(thrust, speed, active && vehicle === 'helicopter');
  }

  pulse(): void {
    if (!this.combat || this.context?.state !== 'running' || this.muted || this.voices >= 12) return;
    this.voices++; this.combat.play('shot', 0, 0, () => this.voices--);
  }

  resetEvents(): void { this.lastEventId = 0; }

  events(events: GameEvent[], playerX: number): void {
    for (const event of events) {
      if (event.id <= this.lastEventId) continue;
      this.lastEventId = event.id;
      if (!this.context || this.context.state !== 'running' || !this.master || this.muted || this.voices >= 16) continue;
      if (this.combat && (event.kind === 'impact' || event.kind === 'explosion' || event.kind === 'player-hit' || event.kind === 'bomb')) {
        this.voices++;
        this.combat.play(event.kind, signedWrappedDeltaX(playerX, event.x, CONFIG.worldWidth) / 110, event.id, () => this.voices--);
        continue;
      }
      const frequencies: Record<GameEvent['kind'], [number, number, number, OscillatorType]> = {
        spawn: [190, 270, 0.18, 'sine'], capture: [850, 480, 0.35, 'triangle'], extraction: [180, 960, 0.48, 'sine'],
        falling: [980, 250, 0.45, 'triangle'], landing: [390, 540, 0.2, 'sine'],
        rescue: [420, 1120, 0.3, 'sine'], delivery: [660, 1580, 0.4, 'sine'],
        lost: [260, 65, 0.5, 'triangle'], mutation: [120, 690, 0.38, 'sawtooth'],
        explosion: [95, 28, 0.38, 'sawtooth'], impact: [320, 80, 0.1, 'square'],
        'bomb-charge': [110, 520, 0.25, 'sine'], bomb: [70, 22, 0.65, 'sawtooth'],
        portal: [210, 1700, 0.55, 'sine'], 'player-hit': [120, 25, 0.6, 'sawtooth'],
        respawn: [360, 880, 0.35, 'sine'], victory: [520, 1560, 0.8, 'triangle'], defeat: [310, 75, 0.8, 'triangle'],
      };
      const [from, to, duration, type] = frequencies[event.kind];
      const context = this.context, oscillator = context.createOscillator(), gain = context.createGain(), pan = context.createStereoPanner();
      const now = context.currentTime;
      oscillator.type = type; oscillator.frequency.setValueAtTime(from + (event.id % 7), now);
      oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(type === 'sawtooth' ? 0.08 : 0.1, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      pan.pan.value = Math.max(-0.9, Math.min(0.9, signedWrappedDeltaX(playerX, event.x, CONFIG.worldWidth) / 110));
      oscillator.connect(gain).connect(pan).connect(this.master);
      this.voices++; oscillator.start(now); oscillator.stop(now + duration + 0.02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); pan.disconnect(); this.voices--; };
    }
  }

  getState(): { initialized: boolean; state: string; muted: boolean; volume: number; enginePitchHz: number;
    vehicle: VehicleId; helicopterSoundInitialized: boolean } {
    return { initialized: this.context !== null, state: this.context?.state ?? 'locked',
      muted: this.muted, volume: this.volume, enginePitchHz: this.enginePitchHz,
      vehicle: this.currentVehicle, helicopterSoundInitialized: this.helicopterSound !== null };
  }

  dispose(): void {
    this.helicopterSound?.dispose();
    this.engine?.stop(); this.engineWhine?.stop();
    void this.context?.close();
  }
}
