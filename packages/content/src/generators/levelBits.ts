// Helpers shared by the circle-of-keys generators (voice leading, melody).
import {
  type Key,
  type PitchClass,
  type Seventh,
  type Triad,
  keySignatureText,
  keySlug,
  keyTitle,
  pretty,
} from '@cadence/music';
import type { Level, Quality, Step } from '../types';

/** The triad on `degree` (0 = I) of `triads`. */
export function triadAt(triads: readonly Triad[], degree: number): Triad {
  const t = triads[degree];
  if (t === undefined) throw new RangeError(`no triad on degree ${degree + 1}`);
  return t;
}

/** Id `${keySlug}-${suffix}`, the key's title, and its signature before `blurb`. */
export function levelBase(key: Key, suffix: string, blurb: string): Omit<Level, 'steps'> {
  return {
    id: `${keySlug(key)}-${suffix}`,
    title: keyTitle(key),
    key: { tonic: key.tonic, mode: key.mode },
    blurb: `${keySignatureText(key).replace(/, /g, ' · ')} ${blurb}`,
  };
}

// ------------------------------------------------------------------ progression steps

/** A chord a progression can use: a triad or a 7th chord, spelled root first. */
export interface ChordDef {
  numeral: string;
  notes: readonly PitchClass[];
  /** The triad underneath (chip colours). */
  quality: Quality;
  /** "Am", "G7", "Cmaj7". */
  short: string;
}

export const chordFromTriad = (t: Triad): ChordDef => ({
  numeral: t.numeral,
  notes: [t.root, t.third, t.fifth],
  quality: t.quality,
  short: t.short,
});

export const chordFromSeventh = (s: Seventh): ChordDef => ({
  numeral: s.numeral,
  notes: [s.root, s.third, s.fifth, s.seventh],
  quality: s.triadQuality,
  short: s.short,
});

/** Figures for a chord with its 3rd, 5th or 7th lowest: triads ⁶ ⁶₄, 7ths ⁶₅ ⁴₃ ⁴₂. */
const FIGURES: Readonly<Record<number, readonly string[]>> = {
  3: ['', '⁶', '⁶₄'],
  4: ['', '⁶₅', '⁴₃', '⁴₂'],
};

/** One chord of a progression step; `inv` puts that chord tone lowest (1 = the 3rd…). */
export interface ProgressionChordDef {
  chord: ChordDef;
  inv?: number;
}

/**
 * A `progression` step (decisions.md 2026-10-10 "Voice leading"): each voice moves at most
 * `maxMove` from what was played. With `twoHands` the left hand plays each chord's bass (its
 * root, or the chord tone `inv` names: a slash chord) and only the right hand is measured.
 * One hand: `inv` asks for that inversion. Chips show the numeral (figured for an inversion)
 * over the chord symbol ("V⁶" over "E/G♯").
 */
export function progressionStep(opts: {
  id: string;
  name: string;
  chords: readonly ProgressionChordDef[];
  twoHands: boolean;
  maxMove: number;
}): Step {
  const { chords, twoHands } = opts;
  return {
    id: opts.id,
    label: chords.map((c) => c.chord.numeral).join(' – '),
    name: opts.name,
    parts: chords.map(({ chord, inv = 0 }) => {
      const bass = chord.notes[inv] ?? chord.notes[0];
      const figure = FIGURES[chord.notes.length]?.[inv] ?? '';
      return {
        label: `${chord.numeral}${figure}`,
        sub: inv === 0 ? pretty(chord.short) : `${pretty(chord.short)}/${pretty(bass ?? '')}`,
        quality: chord.quality,
      };
    }),
    match: {
      type: 'progression',
      chords: chords.map(({ chord, inv }) => {
        const notes = [...chord.notes];
        if (twoHands) return { notes, bass: chord.notes[inv ?? 0] ?? notes[0] ?? 'C' };
        if (inv === undefined) return { notes };
        return { notes, bass: chord.notes[inv] ?? notes[0] ?? 'C' };
      }),
      maxMove: opts.maxMove,
      ...(twoHands ? { freeBass: true } : {}),
    },
  };
}
