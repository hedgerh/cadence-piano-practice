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

// ------------------------------------------------------------------ echo phrases

/**
 * Melody echo (decisions.md 2026-10-17 "Melody tracks"): four tiers of short phrases, two
 * per tier in each key, from the tonic placed in C4..B4.
 *   1 — 3 notes from the tonic, scale steps only.
 *   2 — 4 notes from the tonic back to it, steps (one repeat allowed).
 *   3 — 5 notes from 1, 3 or 5 to the tonic, steps and 3rds (at least one 3rd).
 *   4 — 5 notes from 1, 3 or 5 to a chord tone, steps and 3rds plus exactly one leap of a 4th,
 *       5th or octave between chord tones.
 */
export type EchoTier = 1 | 2 | 3 | 4;
export const ECHO_LENGTH: Readonly<Record<EchoTier, number>> = { 1: 3, 2: 4, 3: 5, 4: 5 };
/** Leaps (in scale positions) tier 4 may take between chord tones: a 4th, a 5th, an octave. */
const ECHO_LEAPS = [3, 4, 7] as const;

/**
 * A deterministic echo phrase in `key` for `tier`. `avoid` lists phrases already used in the
 * level, so a level never asks the same phrase twice.
 */
export function echoPhrase(
  key: Key,
  seed: string,
  tier: EchoTier,
  avoid: readonly (readonly Note[])[] = [],
): Note[] {
  const names = scale(key);
  const offsets = MODE_OFFSETS[key.mode];
  const tonicMidi = 60 + pcNumber(key.tonic);
  const midiAt = (p: number): number =>
    tonicMidi + 12 * Math.floor(p / 7) + (offsets[mod7(p)] ?? 0);
  const inRange = (p: number): boolean => {
    const m = midiAt(p);
    return m >= PHRASE_RANGE.low && m <= PHRASE_RANGE.high;
  };
  const chordTone = (p: number): boolean => CHORD_TONES.has(mod7(p));
  const length = ECHO_LENGTH[tier];
  const rand = mulberry32(hashString(seed));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const used = new Set(avoid.map((p) => p.join(' ')));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const positions = [tier <= 2 ? 0 : pick([0, 2, 4])];
    while (positions.length < length) {
      const prev = positions[positions.length - 1] ?? 0;
      const r = rand();
      const size =
        tier === 1
          ? 1
          : tier === 2
            ? r < 0.8
              ? 1
              : 0
            : tier === 3
              ? r < 0.6
                ? 1
                : 2
              : r < 0.3
                ? pick(ECHO_LEAPS)
                : r < 0.75
                  ? 1
                  : 2;
      const sign = rand() < 0.5 ? -1 : 1;
      const next = inRange(prev + sign * size) ? prev + sign * size : prev - sign * size;
      positions.push(next);
    }
    const moves = positions.slice(1).map((p, i) => p - (positions[i] ?? 0));
    const last = positions[positions.length - 1] ?? 0;
    const leaps = moves.filter((m) => Math.abs(m) > 2);
    let ok = positions.every(inRange);
    if (tier === 1) ok &&= moves.every((m) => Math.abs(m) === 1);
    if (tier === 2) {
      ok &&= mod7(last) === 0 && moves.filter((m) => m === 0).length <= 1;
      ok &&= moves.every((m) => Math.abs(m) <= 1);
    }
    if (tier === 3) {
      ok &&= mod7(last) === 0 && leaps.length === 0 && moves.some((m) => Math.abs(m) === 2);
      ok &&= moves.every((m) => m !== 0);
    }
    if (tier === 4) {
      const leapAt = moves.findIndex((m) => Math.abs(m) > 2);
      ok &&= leaps.length === 1 && chordTone(last) && moves.every((m) => m !== 0);
      ok &&= ECHO_LEAPS.includes(Math.abs(leaps[0] ?? 0) as (typeof ECHO_LEAPS)[number]);
      ok &&= chordTone(positions[leapAt] ?? 1) && chordTone(positions[leapAt + 1] ?? 1);
    }
    if (!ok) continue;
    const notes = positions.map((p) => {
      const name = names[mod7(p)];
      if (name === undefined) throw new RangeError('scale is not 7 notes');
      return spelledNote(midiAt(p), name);
    });
    if (used.has(notes.join(' '))) continue;
    return notes;
  }
  throw new RangeError(`no tier ${tier} echo phrase for seed "${seed}"`);
}
