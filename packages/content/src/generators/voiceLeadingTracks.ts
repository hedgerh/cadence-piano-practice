// The "Voice leading" group (decisions.md 2026-10-10 "Voice leading"; docs/roadmap.md phase 1):
// three circle-of-fifths tracks over the 12 major keys.
//   - Inversion shapes: climb each of I, IV, V, vi through its inversions, then name-and-play
//     every inversion (`chord` + `bass`, any octave).
//   - Smooth progressions: common progressions, right hand, every voice moving ≤ 2 semitones
//     from what you just played (`progression` + `maxMove`).
//   - Bass & chords: the same with a left-hand root under the right hand (`freeBass`).
import {
  CIRCLE_MAJOR,
  type Key,
  type MatchSpec,
  type Triad,
  diatonicTriads,
  keySignatureText,
  keySlug,
  keyTitle,
  pretty,
} from '@cadence/music';
import { numeralAscii } from '../ids';
import { inversionShapesLesson } from '../lessons/inversionShapes';
import { smoothMovesLesson } from '../lessons/smoothMoves';
import type { Level, Step, Track } from '../types';
import { INVERSIONS, inversionBass } from './inversions';

export const VOICE_LEADING_GROUP = 'Voice leading';
/** Each voice may move at most a whole step: common tones stay, the rest step. */
export const MAX_MOVE = 2;

/** Degrees (0 = I) of the chords the shapes track drills: I, IV, V, vi. */
const SHAPE_DEGREES = [0, 3, 4, 5] as const;
/** Name-and-play order: every inversion of I, IV, V, vi, mixed so neighbours differ. */
const RECALL: readonly (readonly [degree: number, inv: 1 | 2])[] = [
  [0, 1],
  [4, 2],
  [3, 1],
  [5, 2],
  [4, 1],
  [0, 2],
  [5, 1],
  [3, 2],
];

function triadAt(triads: readonly Triad[], degree: number): Triad {
  const t = triads[degree];
  if (t === undefined) throw new RangeError(`no triad on degree ${degree + 1}`);
  return t;
}

const notesOf = (t: Triad) => [t.root, t.third, t.fifth];
const label = (t: Triad, inv: number) => `${t.numeral}${INVERSIONS[inv]?.suffix ?? ''}`;

function levelBase(key: Key, suffix: string, blurb: string): Omit<Level, 'steps'> {
  return {
    id: `${keySlug(key)}-${suffix}`,
    title: keyTitle(key),
    key: { tonic: key.tonic, mode: key.mode },
    blurb: `${keySignatureText(key).replace(/, /g, ' · ')} ${blurb}`,
  };
}

// ------------------------------------------------------------------ Inversion shapes

/** Root → 1st → 2nd → root again: the three shapes under one hand, climbing. */
function climbStep(t: Triad): Step {
  const order = [0, 1, 2, 0];
  return {
    id: `climb-${numeralAscii(t.numeral)}`,
    label: `${t.numeral} climb`,
    name: `${t.name}: root position, 1st, 2nd, root again`,
    quality: t.quality,
    parts: order.map((inv) => ({ label: label(t, inv), quality: t.quality })),
    match: {
      type: 'progression',
      chords: order.map((inv) => ({ notes: notesOf(t), bass: inversionBass(t, inv) })),
    },
  };
}

function recallStep(t: Triad, inv: 1 | 2): Step {
  const bass = inversionBass(t, inv);
  return {
    id: `${numeralAscii(t.numeral)}-${INVERSIONS[inv].id}`,
    label: label(t, inv),
    name: `${t.name}, ${pretty(bass)} in the bass`,
    quality: t.quality,
    match: { type: 'chord', notes: notesOf(t), bass },
  };
}

export function inversionShapesLevel(key: Key): Level {
  const triads = diatonicTriads(key);
  const shapes = SHAPE_DEGREES.map((d) => triadAt(triads, d));
  return {
    ...levelBase(
      key,
      'shapes',
      `Chords: ${shapes.map((t) => t.short).join(' · ')} in every position.`,
    ),
    note: 'Find the root: in **1st inversion** it is on top, in **2nd inversion** it is in the middle.',
    steps: [
      ...shapes.map(climbStep),
      ...RECALL.map(([degree, inv]) => recallStep(triadAt(triads, degree), inv)),
    ],
  };
}

export function inversionShapes(): Track {
  return {
    id: 'inversion-shapes',
    title: 'Inversion shapes',
    blurb:
      'The same three notes, a different note at the bottom. Climb I, IV, V and vi through their inversions, then play each inversion by name. One key per level.',
    group: VOICE_LEADING_GROUP,
    map: 'circle-of-fifths',
    available: true,
    lesson: inversionShapesLesson(),
    levels: CIRCLE_MAJOR.map((tonic) => inversionShapesLevel({ tonic, mode: 'major' })),
  };
}

// ------------------------------------------------------------------ progressions

interface ProgressionDef {
  id: string;
  /** Degrees, 0 = I. */
  degrees: readonly number[];
  /** Inversion of the first chord (right hand only). */
  start?: 1 | 2;
  /** Why this one is worth knowing. */
  about: string;
}

const ONE_FOUR_FIVE_ONE = [0, 3, 4, 0];

/** Smooth progressions (right hand): the I–IV–V–I drill from each inversion of I, then songs. */
export const SMOOTH_PROGRESSIONS: readonly ProgressionDef[] = [
  { id: 'I-IV-I', degrees: [0, 3, 0], about: 'keep the shared note' },
  { id: 'I-V-I', degrees: [0, 4, 0], about: 'keep the shared note' },
  { id: 'I-IV-V-I', degrees: ONE_FOUR_FIVE_ONE, about: 'from root position' },
  { id: 'I-IV-V-I-first', degrees: ONE_FOUR_FIVE_ONE, start: 1, about: 'from 1st inversion' },
  { id: 'I-IV-V-I-second', degrees: ONE_FOUR_FIVE_ONE, start: 2, about: 'from 2nd inversion' },
  { id: 'I-V-vi-IV', degrees: [0, 4, 5, 3], about: 'the four chords of a thousand pop songs' },
  { id: 'I-vi-IV-V', degrees: [0, 5, 3, 4], about: 'the fifties progression' },
  { id: 'ii-V-I', degrees: [1, 4, 0], about: 'the strongest way home' },
];

/** Bass & chords: the same songs with a left-hand root (the right hand finds its own shapes). */
export const BASS_PROGRESSIONS: readonly ProgressionDef[] = SMOOTH_PROGRESSIONS.filter(
  (p) => p.start === undefined,
);

function progressionStep(triads: readonly Triad[], def: ProgressionDef, twoHands: boolean): Step {
  const chords = def.degrees.map((d) => triadAt(triads, d));
  const first = chords[0];
  if (first === undefined) throw new RangeError('empty progression');
  const numerals = chords.map((t) => t.numeral).join(' – ');
  const match: MatchSpec = {
    type: 'progression',
    chords: chords.map((t, i) => {
      if (twoHands) return { notes: notesOf(t), bass: t.root };
      if (i === 0 && def.start !== undefined) {
        return { notes: notesOf(t), bass: inversionBass(t, def.start) };
      }
      return { notes: notesOf(t) };
    }),
    maxMove: MAX_MOVE,
    ...(twoHands ? { freeBass: true } : {}),
  };
  return {
    id: def.id,
    label: numerals,
    name: `${chords.map((t) => t.short).join(' – ')} · ${def.about}`,
    parts: chords.map((t, i) => ({
      label: i === 0 && def.start !== undefined ? label(t, def.start) : t.numeral,
      quality: t.quality,
    })),
    match,
  };
}

export function smoothProgressionsLevel(key: Key): Level {
  const triads = diatonicTriads(key);
  return {
    ...levelBase(key, 'smooth', 'Right hand: keep shared notes, step to the rest.'),
    note: 'Each note may move **at most a whole step**. Notes the chords share stay down.',
    steps: SMOOTH_PROGRESSIONS.map((def) => progressionStep(triads, def, false)),
  };
}

export function smoothProgressions(): Track {
  return {
    id: 'smooth-progressions',
    title: 'Smooth progressions',
    blurb:
      'Play common progressions with one hand, moving each note as little as possible: shared notes stay, the rest step. One key per level.',
    group: VOICE_LEADING_GROUP,
    map: 'circle-of-fifths',
    available: true,
    lesson: smoothMovesLesson(),
    levels: CIRCLE_MAJOR.map((tonic) => smoothProgressionsLevel({ tonic, mode: 'major' })),
  };
}

export function bassAndChordsLevel(key: Key): Level {
  const triads = diatonicTriads(key);
  return {
    ...levelBase(key, 'bass', 'Left hand: the root. Right hand: smooth chords above it.'),
    note: 'Left hand plays each **root**, as low as you like. The right hand still moves **at most a whole step**.',
    steps: BASS_PROGRESSIONS.map((def) => progressionStep(triads, def, true)),
  };
}

export function bassAndChords(): Track {
  return {
    id: 'bass-and-chords',
    title: 'Bass & chords',
    blurb:
      'Both hands: the left plays each root, the right voice-leads the chords above it — how pianists accompany themselves. One key per level.',
    group: VOICE_LEADING_GROUP,
    map: 'circle-of-fifths',
    available: true,
    levels: CIRCLE_MAJOR.map((tonic) => bassAndChordsLevel({ tonic, mode: 'major' })),
  };
}
