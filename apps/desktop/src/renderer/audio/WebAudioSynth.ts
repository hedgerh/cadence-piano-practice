// docs/engine.md §7 — voices routed through a master gain and a DynamicsCompressor (−12 dB,
// ratio 4) so chords don't clip. Three voices, picked by the profile's Sound setting
// (decisions.md 2026-10-11 "Sound setting"):
//   samples — the recorded grand piano (decisions.md 2026-10-07 "Piano voice"): the nearest
//             sample, pitched by playbackRate, held for `dur` and then damped; until the samples
//             are decoded (or if they fail) the tone plays instead;
//   synth   — the additive piano in pianoSynth.ts;
//   tone    — the design's own tone() (EarInterval:105–117: a triangle oscillator).
import type { Sound } from '@cadence/content';
import { midiToFrequency, type Midi } from '@cadence/music';
import type { SoundVoice } from '@shared/ipc/contracts';
import {
  loadPianoSamples,
  nearestSample,
  type SampleBank,
  type SampleLoader,
} from './pianoSamples';
import { sampleGains } from './pianoGains';
import { playSynthPiano } from './pianoSynth';
import { playSound } from './player';
import type { PlayOptions, Synth } from './Synth';

export const PEAK_GAIN = 0.25;
export const FLOOR_GAIN = 0.0001;
export const ATTACK = 0.02;
export const RELEASE_TAIL = 0.05;
export const COMPRESSOR_THRESHOLD_DB = -12;
export const COMPRESSOR_RATIO = 4;
/** Piano level before the compressor (the samples are recorded well below full scale). */
export const PIANO_GAIN = 0.9;
/** After `dur` the key is let go: the damper fades the string out over this long. */
export const DAMPER = 0.4;

type ContextFactory = () => AudioContext;

const defaultFactory: ContextFactory = () => new AudioContext();

export class WebAudioSynth implements Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private samples: SampleBank | null = null;
  private loading: Promise<void> | null = null;
  private readonly active = new Set<AudioScheduledSourceNode>();
  private readonly pending = new Set<() => void>();
  private volume = 1;
  private voiceSetting: SoundVoice = 'samples';

  constructor(
    private readonly createContext: ContextFactory = defaultFactory,
    private readonly loadSamples: SampleLoader = loadPianoSamples,
  ) {}

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
    this.loading = this.loadSamples(ctx).then(
      (bank) => {
        if (bank.size > 0) this.samples = bank;
      },
      () => undefined, // keep the oscillator voice
    );
    return { ctx, master };
  }

  /** Resumes the context and waits for the piano samples, so a play right after uses them. */
  async unlock(): Promise<void> {
    const { ctx } = this.ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    await this.loading;
  }

  /** The Sound setting; takes effect from the next note. */
  setVoice(voice: SoundVoice): void {
    this.voiceSetting = voice;
  }

  /** The voice `playMidi` uses right now: the setting, or `tone` while samples are missing. */
  get voice(): SoundVoice {
    if (this.voiceSetting === 'samples' && !this.samples) return 'tone';
    return this.voiceSetting;
  }

  now(): number {
    return this.ensure().ctx.currentTime;
  }

  playMidi(notes: readonly Midi[], at: number, dur: number): void {
    const { ctx, master } = this.ensure();
    const voice = this.voice;
    for (const midi of notes) {
      if (voice === 'samples' && this.samples) {
        this.pianoVoice(ctx, master, this.samples, midi, at, dur);
      } else if (voice === 'synth') {
        playSynthPiano(ctx, master, midi, at, dur, this.track);
      } else {
        this.toneVoice(ctx, master, midi, at, dur);
      }
    }
  }

  private pianoVoice(
    ctx: AudioContext,
    master: GainNode,
    bank: SampleBank,
    midi: Midi,
    at: number,
    dur: number,
  ): void {
    const root = nearestSample(midi, [...bank.keys()]);
    const buffer = root === null ? undefined : bank.get(root);
    if (root === null || buffer === undefined) {
      this.toneVoice(ctx, master, midi, at, dur);
      return;
    }
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = 2 ** ((midi - root) / 12);
    // Struck at full level (the sample has its own attack), held, then damped.
    gain.gain.setValueAtTime(PIANO_GAIN, at);
    gain.gain.setValueAtTime(PIANO_GAIN, at + dur);
    gain.gain.exponentialRampToValueAtTime(FLOOR_GAIN, at + dur + DAMPER);
    // decisions.md 2026-10-12: the sample's baked [left, right] gains even out its loudness and
    // centre it (src → splitter → per-channel gain → merger → envelope).
    const [left, right] = sampleGains(root);
    const balanced = this.balance(ctx, src, buffer.numberOfChannels, left, right);
    balanced.connect(gain);
    gain.connect(master);
    src.onended = () => {
      this.active.delete(src);
      balanced.disconnect();
      gain.disconnect();
    };
    this.active.add(src);
    src.start(at);
    src.stop(at + dur + DAMPER + RELEASE_TAIL);
  }

  /** Per-channel gains on `src` (a mono buffer gets their mean); returns the node to connect on. */
  private balance(
    ctx: AudioContext,
    src: AudioNode,
    channels: number,
    left: number,
    right: number,
  ): AudioNode {
    if (channels < 2) {
      const g = ctx.createGain();
      g.gain.value = (left + right) / 2;
      src.connect(g);
      return g;
    }
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    const gl = ctx.createGain();
    const gr = ctx.createGain();
    gl.gain.value = left;
    gr.gain.value = right;
    src.connect(split);
    split.connect(gl, 0);
    split.connect(gr, 1);
    gl.connect(merge, 0, 0);
    gr.connect(merge, 0, 1);
    return merge;
  }

  /** EarInterval:105–117 tone(): triangle, 20 ms attack, exponential decay over `dur`. */
  private toneVoice(ctx: AudioContext, master: GainNode, midi: Midi, at: number, dur: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = midiToFrequency(midi);
    gain.gain.setValueAtTime(FLOOR_GAIN, at);
    gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, at + ATTACK);
    gain.gain.exponentialRampToValueAtTime(FLOOR_GAIN, at + dur);
    this.start(osc, gain, master, at, at + dur + RELEASE_TAIL);
  }

  /** Register a source for `stop()`; the returned callback forgets it once it has ended. */
  private readonly track = (src: AudioScheduledSourceNode): (() => void) => {
    this.active.add(src);
    return () => this.active.delete(src);
  };

  private start(
    src: AudioScheduledSourceNode,
    gain: GainNode,
    master: GainNode,
    at: number,
    stopAt: number,
  ): void {
    src.connect(gain);
    gain.connect(master);
    src.onended = () => {
      this.active.delete(src);
      gain.disconnect();
    };
    this.active.add(src);
    src.start(at);
    src.stop(stopAt);
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
    for (const src of this.active) {
      try {
        src.stop();
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
