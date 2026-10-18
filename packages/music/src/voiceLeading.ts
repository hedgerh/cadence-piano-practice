// Voice leading (decisions.md 2026-10-10 "Voice leading"): how far each note moves from one
// chord to the next, the nearest voicing of the next chord, and whole voice-led paths that
// hints, play-backs and the content validator share. Voices pair low to high.
import { type Midi, type Pc, midiToPc } from './pitch';
import { PRACTICE_RANGE, placeRoot, stackAbove } from './voicing';

/** One chord of a progression as pitch classes; `bass` = the pitch class that must be lowest. */
export interface ChordTarget {
  pcs: readonly Pc[];
  bass?: Pc;
}

/**
 * The three-octave keyboard progressions are shown on: C2 (36) .. B4 (71). A left-hand bass
 * sits in C2..B2 under a right hand in C3..B4; a one-hand climb through all three inversions
 * spans more than the two-octave keyboard, so it uses the whole range.
 */
export const TWO_HAND_RANGE: Readonly<{ low: Midi; high: Midi }> = { low: 36, high: 71 };
export const BASS_OCTAVE_LOW: Midi = 36;

const ascending = (notes: readonly Midi[]): Midi[] => [...notes].sort((a, b) => a - b);

/** Signed semitone move of each voice, pairing the voices low to high; null if counts differ. */
export function voiceMotion(from: readonly Midi[], to: readonly Midi[]): number[] | null {
  if (from.length !== to.length) return null;
  const a = ascending(from);
  const b = ascending(to);
  return a.map((m, i) => (b[i] ?? m) - m);
}

/** Rotate `pcs` so the chord tone `bass` comes first (root position when absent). */
export function rotateToBass(pcs: readonly Pc[], bass?: Pc): Pc[] {
  const i = bass === undefined ? 0 : pcs.findIndex((pc) => midiToPc(pc) === midiToPc(bass));
  if (i < 0) throw new RangeError('bass is not a chord tone');
  return [...pcs.slice(i), ...pcs.slice(0, i)];
}

/**
 * Close-position voicing with `bass` (or the root) placed in D3..C♯4: the hint placement. A
 * chord whose top note would pass B4 (a 7th chord from C♯4) drops an octave, so hints stay on
 * the practice keyboard (decisions.md 2026-10-18 "7th chords"); triads never reach it.
 */
export function placeChord(chord: ChordTarget): Midi[] {
  const [low, ...rest] = rotateToBass(chord.pcs, chord.bass);
  if (low === undefined) return [];
  const notes = stackAbove(placeRoot(low), rest);
  return Math.max(...notes) > PRACTICE_RANGE.high ? notes.map((m) => m - 12) : notes;
}

/**
 * The close-position voicing of `chord` nearest to `from` (same number of voices): least total
 * motion, then most common tones, then the smallest single move, then the lower voicing.
 */
export function smoothestVoicing(from: readonly Midi[], chord: ChordTarget): Midi[] {
  const pcs = chord.pcs;
  if (from.length !== pcs.length || from.length === 0) return placeChord(chord);
  const lo = Math.min(...from) - 12;
  const hi = Math.max(...from) + 12;
  let best: { notes: Midi[]; cost: number[] } | null = null;
  for (let r = 0; r < pcs.length; r++) {
    const [first, ...rest] = [...pcs.slice(r), ...pcs.slice(0, r)];
    if (first === undefined) continue;
    if (chord.bass !== undefined && midiToPc(first) !== midiToPc(chord.bass)) continue;
    for (let base = lo; base <= hi; base++) {
      if (midiToPc(base) !== midiToPc(first)) continue;
      const notes = stackAbove(base, rest);
      const moves = (voiceMotion(from, notes) ?? []).map(Math.abs);
      const cost = [
        moves.reduce((s, m) => s + m, 0),
        -moves.filter((m) => m === 0).length,
        Math.max(...moves),
        base,
      ];
      if (best === null || lexLess(cost, best.cost)) best = { notes, cost };
    }
  }
  return best?.notes ?? placeChord(chord);
}

function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/** The left-hand bass note for `pc`: always in C2..B2 so the hand stays put. */
export function placeBass(pc: Pc): Midi {
  return BASS_OCTAVE_LOW + midiToPc(pc);
}

/**
 * The next voicing after `prev` (null = the first chord). With `freeBass` the lowest note is a
 * left-hand bass (`chord.bass`, placed by `placeBass`) and only the notes above it are led.
 */
export function nextVoicing(
  prev: readonly Midi[] | null,
  chord: ChordTarget,
  freeBass = false,
): Midi[] {
  if (!freeBass) {
    return prev === null || prev.length === 0 ? placeChord(chord) : smoothestVoicing(prev, chord);
  }
  const upperChord: ChordTarget = { pcs: chord.pcs };
  const upper =
    prev === null || prev.length < 2
      ? placeChord(upperChord)
      : smoothestVoicing(ascending(prev).slice(1), upperChord);
  const bass = placeBass(chord.bass ?? chord.pcs[0] ?? 0);
  return [bass, ...upper];
}

/**
 * A whole voice-led path: the first chord placed (`placeChord`), each next one the smoothest.
 * The voices are then shifted by octaves, if needed, so hints and play-backs stay on the
 * keyboard: the right hand of a two-hand path in C3..B4, a one-hand path in C2..B4 (moved
 * down only as far as needed, so it stays in C3..B4 whenever it fits there).
 */
export function voiceLead(chords: readonly ChordTarget[], freeBass = false): Midi[][] {
  const path: Midi[][] = [];
  let prev: Midi[] | null = null;
  for (const chord of chords) {
    prev = nextVoicing(prev, chord, freeBass);
    path.push(prev);
  }
  const upper = path.flatMap((v) => (freeBass ? ascending(v).slice(1) : v));
  if (upper.length === 0) return path;
  const range = freeBass ? PRACTICE_RANGE : TWO_HAND_RANGE;
  const top = Math.max(...upper);
  const bottom = Math.min(...upper);
  let shift = 0;
  if (top > range.high) shift = -12 * Math.ceil((top - range.high) / 12);
  else if (bottom < range.low) shift = 12 * Math.ceil((range.low - bottom) / 12);
  if (shift === 0) return path;
  return path.map((v) => {
    const sorted = ascending(v);
    return freeBass
      ? [sorted[0] ?? 0, ...sorted.slice(1).map((m) => m + shift)]
      : sorted.map((m) => m + shift);
  });
}
