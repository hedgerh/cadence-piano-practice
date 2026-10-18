// engine.md §1 keys.ts — keys, scales and key signatures (natural minor throughout v1).
import { MODE_OFFSETS, type PitchClass, pcName, pcNumber, pretty, spellOnLetters } from './pitch';

export type Mode = 'major' | 'minor';
export interface Key {
  tonic: PitchClass;
  mode: Mode;
}

/** The design's circle of fifths, clockwise from C (HANDOFF §4: levels one per key). */
export const CIRCLE_MAJOR: readonly PitchClass[] = [
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'Gb',
  'Db',
  'Ab',
  'Eb',
  'Bb',
  'F',
];
/** Relative minors in the same order, with the design's enharmonic spellings. */
export const CIRCLE_MINOR: readonly PitchClass[] = [
  'A',
  'E',
  'B',
  'F#',
  'C#',
  'G#',
  'Eb',
  'Bb',
  'F',
  'C',
  'G',
  'D',
];

/** All 24 keys: the 12 majors then the 12 minors, circle order. */
export const ALL_KEYS: readonly Key[] = [
  ...CIRCLE_MAJOR.map((tonic): Key => ({ tonic, mode: 'major' })),
  ...CIRCLE_MINOR.map((tonic): Key => ({ tonic, mode: 'minor' })),
];

const SHARP_ORDER: readonly PitchClass[] = ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'];
const FLAT_ORDER: readonly PitchClass[] = ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'];
const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'] as const;

/** The seven scale degrees, spelled on consecutive letters from the tonic. */
export function scale(key: Key): PitchClass[] {
  return spellOnLetters(key.tonic, MODE_OFFSETS[key.mode]);
}

/** Harmonic minor on the key's tonic: natural minor with a raised 7th (the leading tone). */
export const HARMONIC_MINOR_OFFSETS: readonly number[] = [0, 2, 3, 5, 7, 8, 11];

/**
 * The harmonic minor scale on `key`'s tonic (decisions.md 2026-10-18 "Minor progressions").
 * Throws where the raised 7th would need a double sharp (G♯ minor's F𝄪): use the enharmonic
 * key (`spellableMinor`).
 */
export function harmonicMinorScale(key: Key): PitchClass[] {
  return spellOnLetters(key.tonic, HARMONIC_MINOR_OFFSETS);
}

/** `key`, or its flat-side twin when its harmonic minor needs a double sharp (G♯ → A♭ minor). */
export function spellableMinor(key: Key): Key {
  try {
    harmonicMinorScale(key);
    return key;
  } catch {
    return { tonic: pcName(pcNumber(key.tonic), 'flats'), mode: key.mode };
  }
}

export interface KeySignature {
  sharps: number;
  flats: number;
  /** Accidentals in signature order (F# C# G# … / Bb Eb Ab …). */
  accidentals: PitchClass[];
}

export function keySignature(key: Key): KeySignature {
  const notes = scale(key);
  const sharps = SHARP_ORDER.filter((n) => notes.includes(n));
  const flats = FLAT_ORDER.filter((n) => notes.includes(n));
  return {
    sharps: sharps.length,
    flats: flats.length,
    accidentals: sharps.length > 0 ? sharps : flats,
  };
}

/** "Three sharps: F♯, C♯, G♯." · "No sharps or flats." · "Two flats: B♭, E♭." */
export function keySignatureText(key: Key): string {
  const sig = keySignature(key);
  const n = sig.sharps || sig.flats;
  if (n === 0) return 'No sharps or flats.';
  const word = NUMBER_WORDS[n] ?? String(n);
  const kind = sig.sharps > 0 ? 'sharp' : 'flat';
  return `${word} ${kind}${n === 1 ? '' : 's'}: ${sig.accidentals.map(pretty).join(', ')}.`;
}

/** Relative minor of a major key (degree 6). A minor key is returned unchanged. */
export function relativeMinor(key: Key): Key {
  if (key.mode === 'minor') return key;
  const notes = scale(key);
  const tonic = notes[5];
  if (tonic === undefined) throw new RangeError('scale has no sixth degree');
  return { tonic, mode: 'minor' };
}

/** Relative major of a minor key (degree 3). A major key is returned unchanged. */
export function relativeMajor(key: Key): Key {
  if (key.mode === 'major') return key;
  const notes = scale(key);
  const tonic = notes[2];
  if (tonic === undefined) throw new RangeError('scale has no third degree');
  return { tonic, mode: 'major' };
}

/** "E♭ minor", "A major". */
export function keyTitle(key: Key): string {
  return `${pretty(key.tonic)} ${key.mode}`;
}

/** "a-major", "eb-minor", "fs-minor". */
export function keySlug(key: Key): string {
  return `${key.tonic.replace('#', 's').toLowerCase()}-${key.mode}`;
}
