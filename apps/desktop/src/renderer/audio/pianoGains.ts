// decisions.md 2026-10-12 "Sample loudness": baked [left, right] gains per piano sample.
// Measured once (2026-10-12) with `measureSampleGains` from pianoSamples.ts on the bundled files:
// each channel's RMS over the first 0.5 s after the note starts, brought to the median channel
// loudness (≈ −22.3 dBFS) so every note is equally loud and centred, with any boost capped at
// 2.5× (+8 dB) and every peak kept under 0.98. The app only multiplies these in; it never
// analyses audio. Re-measure with `__cadenceDev.audio.measureSamples()` if the files change.
import type { Midi } from '@cadence/music';
import { sampleMidi } from './pianoSamples';

export const PIANO_SAMPLE_GAINS: Readonly<Record<string, readonly [number, number]>> = {
  C2: [0.692, 0.975],
  Ds2: [0.672, 0.714],
  Fs2: [0.53, 0.81],
  A2: [0.84, 1.021],
  C3: [0.657, 1.312],
  Ds3: [1.063, 0.67],
  Fs3: [0.878, 1.147],
  A3: [1.321, 1.114],
  C4: [1.18, 0.639],
  Ds4: [1.262, 0.958],
  Fs4: [1.109, 0.98],
  A4: [1.825, 0.751],
  C5: [1.541, 0.867],
  Ds5: [2.5, 0.919],
  Fs5: [1.407, 0.872],
  A5: [2.492, 1.377],
  C6: [2.023, 2.5],
};

const BY_MIDI = new Map<Midi, readonly [number, number]>(
  Object.entries(PIANO_SAMPLE_GAINS).flatMap(([name, gains]) => {
    const midi = sampleMidi(`./piano/${name}.mp3`);
    return midi === null ? [] : [[midi, gains] as const];
  }),
);

/** The baked [left, right] gains of the sample at `midi` ([1, 1] if it has none). */
export function sampleGains(midi: Midi): readonly [number, number] {
  return BY_MIDI.get(midi) ?? [1, 1];
}
