// engine.md §2.2 Phrases — deterministic seeded melodies for find-the-key: 8 quarter notes
// from the key's scale with the tonic placed in C4..B4; start on 1 or 5; moves are a scale
// step 70% / diatonic 3rd 20% / repeat 10%; ≥3 chord tones; every note in 55..79.
import { type Key, MODE_OFFSETS, type Note, pcNumber, scale, spelledNote } from '@cadence/music';

export const PHRASE_LENGTH = 8;
export const PHRASE_RANGE = { low: 55, high: 79 } as const;
export const PHRASE_MIN_CHORD_TONES = 3;

/** How the phrase ends: on the tonic (find-the-key L1–L2) or on the 3rd/5th (L3). */
export type PhraseEnd = 'tonic' | 'third-or-fifth';

/** FNV-1a 32-bit hash of a string (the PRNG seed). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a tiny deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mod7 = (p: number): number => ((p % 7) + 7) % 7;
/** Degree positions (0-based, mod 7) that belong to the tonic triad: 1, 3, 5. */
const CHORD_TONES = new Set([0, 2, 4]);
const MAX_ATTEMPTS = 1000;

/**
 * A deterministic 8-note phrase in `key`. `seed` should be unique per step (the generator
 * uses the step's progress key). Rejection-samples random walks until one satisfies every
 * rule, so the same seed always yields the same phrase.
 */
export function phrase(key: Key, seed: string, end: PhraseEnd): Note[] {
  const names = scale(key);
  const offsets = MODE_OFFSETS[key.mode];
  const tonicMidi = 60 + pcNumber(key.tonic); // C4..B4
  const midiAt = (p: number): number =>
    tonicMidi + 12 * Math.floor(p / 7) + (offsets[mod7(p)] ?? 0);
  const inRange = (p: number): boolean => {
    const m = midiAt(p);
    return m >= PHRASE_RANGE.low && m <= PHRASE_RANGE.high;
  };
  const rand = mulberry32(hashString(seed));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const positions = [rand() < 0.5 ? 0 : 4];
    while (positions.length < PHRASE_LENGTH) {
      const prev = positions[positions.length - 1] ?? 0;
      const r = rand();
      const size = r < 0.7 ? 1 : r < 0.9 ? 2 : 0;
      const sign = rand() < 0.5 ? -1 : 1;
      const next = inRange(prev + sign * size) ? prev + sign * size : prev - sign * size;
      positions.push(next);
    }
    const last = mod7(positions[positions.length - 1] ?? 0);
    const endsRight = end === 'tonic' ? last === 0 : last === 2 || last === 4;
    const chordTones = positions.filter((p) => CHORD_TONES.has(mod7(p))).length;
    if (endsRight && chordTones >= PHRASE_MIN_CHORD_TONES && positions.every(inRange)) {
      return positions.map((p) => {
        const name = names[mod7(p)];
        if (name === undefined) throw new RangeError('scale is not 7 notes');
        return spelledNote(midiAt(p), name);
      });
    }
  }
  throw new RangeError(`no phrase satisfies the rules for seed "${seed}"`);
}
