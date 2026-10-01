// docs/ui.md §2 PianoKeyboard — geometry is computed, never hardcoded.
// Practice:90 (661px container), Practice:148–151 (C3..B4 whites, black-key lefts),
// EarInterval:81, 166–167 (one octave, 332px).
import { midiToPc, pcName, type Midi } from '@cadence/music';

export type KeyboardVariant = 'two-octave' | 'one-octave';

export interface KeyboardGeometry {
  octaves: number;
  /** First (lowest) white key, always a C. */
  startMidi: Midi;
  whiteWidth: number;
  whiteHeight: number;
  blackWidth: number;
  blackHeight: number;
  gap: number;
  padding: number;
}

export const KEYBOARD_GEOMETRY: Readonly<Record<KeyboardVariant, KeyboardGeometry>> = {
  // Practice:90, 163, 170 — C3 (48) .. B4 (71).
  'two-octave': {
    octaves: 2,
    startMidi: 48,
    whiteWidth: 44,
    whiteHeight: 150,
    blackWidth: 28,
    blackHeight: 95,
    gap: 3,
    padding: 3,
  },
  // EarInterval:81, 171, 175 — one octave; C4 (60) .. B4 (71) by default.
  'one-octave': {
    octaves: 1,
    startMidi: 60,
    whiteWidth: 44,
    whiteHeight: 120,
    blackWidth: 28,
    blackHeight: 76,
    gap: 3,
    padding: 3,
  },
};

/** Semitone offsets of the white keys within an octave (C D E F G A B). */
const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11] as const;
/** White keys (within an octave) that have a black key to their right: C D F G A. */
const HAS_BLACK_RIGHT: readonly boolean[] = [true, true, false, true, true, true, false];

export interface WhiteKey {
  /** Index among the white keys, left to right. */
  index: number;
  midi: Midi;
  /** Letter shown at the bottom of the key (Practice:166 strips the octave). */
  label: string;
}

export interface BlackKey {
  midi: Midi;
  /** Index of the white key to its left. */
  afterWhite: number;
  /** `left` in px inside the container: 47·(i+1) − 12.5 (centred on the gap). */
  leftPx: number;
}

/** Total container width: whites + gaps + padding (661 / 332). */
export function keyboardWidth(variant: KeyboardVariant): number {
  const g = KEYBOARD_GEOMETRY[variant];
  const whites = g.octaves * 7;
  return whites * g.whiteWidth + (whites - 1) * g.gap + 2 * g.padding;
}

export function whiteKeys(variant: KeyboardVariant, startMidi?: Midi): WhiteKey[] {
  const g = KEYBOARD_GEOMETRY[variant];
  const start = startMidi ?? g.startMidi;
  const keys: WhiteKey[] = [];
  for (let o = 0; o < g.octaves; o++) {
    WHITE_OFFSETS.forEach((offset, j) => {
      const midi = start + o * 12 + offset;
      keys.push({ index: o * 7 + j, midi, label: pcName(midiToPc(midi)) });
    });
  }
  return keys;
}

/**
 * Black keys sit centred on the 3px gap after white key `i`. White key `i` starts at
 * `padding + i·(width + gap)` = 3 + 47i and ends at 47(i+1); the gap centre is
 * 47(i+1) + 1.5, so a 28px key starts at 47(i+1) − 12.5.
 */
export function blackKeys(variant: KeyboardVariant, startMidi?: Midi): BlackKey[] {
  const g = KEYBOARD_GEOMETRY[variant];
  const pitch = g.whiteWidth + g.gap;
  const keys: BlackKey[] = [];
  for (const white of whiteKeys(variant, startMidi)) {
    if (!HAS_BLACK_RIGHT[white.index % 7]) continue;
    const gapCentre = g.padding + pitch * white.index + g.whiteWidth + g.gap / 2;
    keys.push({
      midi: white.midi + 1,
      afterWhite: white.index,
      leftPx: gapCentre - g.blackWidth / 2,
    });
  }
  return keys;
}
