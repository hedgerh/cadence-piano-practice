// docs/engine.md §7 — the voice is the design's own tone() (EarInterval:105–117), routed
// through a master gain and a DynamicsCompressor (−12 dB, ratio 4) so chords don't clip.
import type { Sound } from '@cadence/content';
import { midiToFrequency, type Midi } from '@cadence/music';
import { playSound } from './player';
import type { PlayOptions, Synth } from './Synth';

export const PEAK_GAIN = 0.25;
export const FLOOR_GAIN = 0.0001;
export const ATTACK = 0.02;
export const RELEASE_TAIL = 0.05;
export const COMPRESSOR_THRESHOLD_DB = -12;
export const COMPRESSOR_RATIO = 4;

type ContextFactory = () => AudioContext;

const defaultFactory: ContextFactory = () => new AudioContext();

export class WebAudioSynth implements Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly active = new Set<OscillatorNode>();
  private readonly pending = new Set<() => void>();
  private volume = 1;

  constructor(private readonly createContext: ContextFactory = defaultFactory) {}

  private ensure(): { ctx: AudioContext; master: GainNode } {
    if (this.ctx && this.master) return { ctx: this.ctx, master: this.master };
    const ctx = this.createContext();
    const master = ctx.createGain();
    master.gain.value = this.volume;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = COMPRESSOR_THRESHOLD_DB;
    compressor.ratio.value = COMPRESSOR_RATIO;
    master.connect(compressor);
    compressor.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    return { ctx, master };
  }

  async unlock(): Promise<void> {
    const { ctx } = this.ensure();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  now(): number {
    return this.ensure().ctx.currentTime;
  }

  playMidi(notes: readonly Midi[], at: number, dur: number): void {
    const { ctx, master } = this.ensure();
    for (const midi of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = midiToFrequency(midi);
      gain.gain.setValueAtTime(FLOOR_GAIN, at);
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, at + ATTACK);
      gain.gain.exponentialRampToValueAtTime(FLOOR_GAIN, at + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.onended = () => {
        this.active.delete(osc);
        gain.disconnect();
      };
      this.active.add(osc);
      osc.start(at);
      osc.stop(at + dur + RELEASE_TAIL);
    }
  }

  async play(sound: Sound, opts?: PlayOptions): Promise<void> {
    // Resume inside every play: Chromium may suspend an idle context (ui.md §4).
    await this.unlock();
    const seconds = playSound(this, sound);
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.pending.delete(done);
        resolve();
      };
      const timer = setTimeout(done, seconds * 1000);
      this.pending.add(done);
    });
    opts?.onEnd?.();
  }

  stop(): void {
    for (const osc of this.active) {
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
    }
    this.active.clear();
    for (const done of [...this.pending]) done();
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.master) this.master.gain.value = this.volume;
  }
}
