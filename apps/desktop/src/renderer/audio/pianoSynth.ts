// The "Synth piano" voice (decisions.md 2026-10-11 "Sound setting"): additive synthesis from
// the physics of a struck string, no samples. Per note:
//   - PARTIALS sine partials, stretched by string stiffness (f_n = n·f0·√(1 + B·n²)), weighted by
//     the hammer's strike point (|sin(π·n·STRIKE)| / n^ROLLOFF, so the ~7th partial is weak);
//   - two-stage decay: a quick drop (the "prompt sound"), then a long ring whose time constant
//     shrinks with pitch and with partial number (high partials die first);
//   - the lowest UNISON partials doubled on a second "string" detuned by DETUNE_CENTS (beating);
//   - a short band-passed noise burst for the hammer;
//   - a damper on the note gain after `dur`.
// The parameter functions are pure so tests can pin the tone without an AudioContext.
import { midiToFrequency, type Midi } from '@cadence/music';

export const PARTIALS = 10;
/** Hammer strike point as a fraction of the string length. */
export const STRIKE = 1 / 7;
export const ROLLOFF = 1.1;
/** String stiffness (inharmonicity). */
export const INHARMONICITY = 0.0004;
/** Partials doubled on a detuned second string. */
export const UNISON = 3;
export const DETUNE_CENTS = 1.2;
/** Peak level of a whole note before the compressor. */
export const NOTE_PEAK = 0.32;
export const ATTACK = 0.005;
/** The quick first drop: to this share of the peak, with this time constant. */
export const PROMPT_LEVEL = 0.45;
export const PROMPT_TC = 0.08;
export const DAMPER = 0.25;
export const HAMMER_GAIN = 0.06;
export const HAMMER_DUR = 0.03;
/** Partials above this are skipped (inaudible and close to Nyquist). */
export const MAX_PARTIAL_HZ = 16_000;

/** Frequency of partial `n` (1-based) of a note at `f0` Hz. */
export function partialFrequency(f0: number, n: number): number {
  return n * f0 * Math.sqrt(1 + INHARMONICITY * n * n);
}

/** Relative strength of partial `n` before normalisation. */
export function partialWeight(n: number): number {
  return Math.abs(Math.sin(Math.PI * n * STRIKE)) / n ** ROLLOFF;
}

/** Long-ring time constant (s) of partial `n` for `midi`: ~3.2 s at C3, halving every 2 octaves. */
export function ringTimeConstant(midi: Midi, n: number): number {
  const base = 3.2 * 2 ** (-(midi - 48) / 24);
  return base / (1 + 0.6 * (n - 1));
}

export interface PartialPlan {
  freq: number;
  /** Peak gain of this oscillator (the note's partials sum to NOTE_PEAK). */
  gain: number;
  ringTc: number;
}

/** Every oscillator one note needs (unison partials appear twice, detuned ±DETUNE_CENTS/2). */
export function planNote(midi: Midi): PartialPlan[] {
  const f0 = midiToFrequency(midi);
  const ns = Array.from({ length: PARTIALS }, (_, i) => i + 1).filter(
    (n) => partialFrequency(f0, n) < MAX_PARTIAL_HZ,
  );
  const total = ns.reduce((sum, n) => sum + partialWeight(n), 0);
  const plans: PartialPlan[] = [];
  for (const n of ns) {
    const freq = partialFrequency(f0, n);
    const gain = (NOTE_PEAK * partialWeight(n)) / total;
    const ringTc = ringTimeConstant(midi, n);
    if (n <= UNISON) {
      const spread = 2 ** (DETUNE_CENTS / 2 / 1200);
      plans.push({ freq: freq * spread, gain: gain / 2, ringTc });
      plans.push({ freq: freq / spread, gain: gain / 2, ringTc });
    } else {
      plans.push({ freq, gain, ringTc });
    }
  }
  return plans;
}

let noise: { ctx: BaseAudioContext; buffer: AudioBuffer } | null = null;

function hammerNoise(ctx: BaseAudioContext): AudioBuffer {
  if (noise?.ctx === ctx) return noise.buffer;
  const length = Math.max(1, Math.ceil(ctx.sampleRate * HAMMER_DUR));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noise = { ctx, buffer };
  return buffer;
}

/**
 * Schedule one synthesized piano note on `dest`. `track(src)` registers each source with the
 * synth (for `stop()`) and returns the callback to run when that source ends.
 */
export function playSynthPiano(
  ctx: BaseAudioContext,
  dest: AudioNode,
  midi: Midi,
  at: number,
  dur: number,
  track: (src: AudioScheduledSourceNode) => () => void,
): void {
  const note = ctx.createGain();
  note.gain.setValueAtTime(1, at);
  note.gain.setValueAtTime(1, at + dur);
  note.gain.exponentialRampToValueAtTime(0.0001, at + dur + DAMPER);
  note.connect(dest);
  const stopAt = at + dur + DAMPER + 0.05;

  const sources: { src: AudioScheduledSourceNode; gain: AudioNode }[] = [];
  for (const p of planNote(midi)) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = p.freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(p.gain, at + ATTACK);
    g.gain.setTargetAtTime(p.gain * PROMPT_LEVEL, at + ATTACK, PROMPT_TC);
    g.gain.setTargetAtTime(0, at + ATTACK + 2 * PROMPT_TC, p.ringTc);
    osc.connect(g);
    g.connect(note);
    sources.push({ src: osc, gain: g });
  }

  const hammer = ctx.createBufferSource();
  hammer.buffer = hammerNoise(ctx);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = Math.min(4000, midiToFrequency(midi) * 4);
  band.Q.value = 0.8;
  const hg = ctx.createGain();
  hg.gain.setValueAtTime(HAMMER_GAIN, at);
  hg.gain.exponentialRampToValueAtTime(0.0001, at + HAMMER_DUR);
  hammer.connect(band);
  band.connect(hg);
  hg.connect(note);
  sources.push({ src: hammer, gain: hg });

  let live = sources.length;
  for (const { src, gain } of sources) {
    const done = track(src);
    src.onended = () => {
      done();
      gain.disconnect();
      live -= 1;
      if (live === 0) note.disconnect();
    };
    src.start(at);
    src.stop(src === hammer ? at + HAMMER_DUR + 0.01 : stopAt);
  }
}
