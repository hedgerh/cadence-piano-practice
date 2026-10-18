// Minor progressions (decisions.md 2026-10-18 "Minor progressions"): smooth progressions in the
// 12 minor keys, with the leading tone — V major and vii° from the harmonic minor's raised 7th
// (declared in `extraNotes`). G♯ minor's raised 7th would be F𝄪, so its slot uses A♭ minor.
import {
  CIRCLE_MINOR,
  type Key,
  harmonicMinorScale,
  harmonicTriads,
  pretty,
  spellableMinor,
} from '@cadence/music';
import { minorProgressionsLesson } from '../lessons/minorProgressions';
import type { Level, Track } from '../types';
import { chordFromTriad, levelBase, progressionStep, triadAt } from './levelBits';
import { MAX_MOVE, VOICE_LEADING_GROUP } from './voiceLeadingTracks';

interface MinorProgressionDef {
  id: string;
  /** Degrees, 0 = i (V and vii° are the raised-7th chords). */
  degrees: readonly number[];
  twoHands?: boolean;
  /**
   * Into V from iv or ii° one voice must move a minor 3rd: the raised 7th sits an augmented
   * 2nd above the 6th (F → G♯ in A minor), so no whole-step path exists.
   */
  maxMove?: number;
  about: string;
}

export const MINOR_PROGRESSIONS: readonly MinorProgressionDef[] = [
  { id: 'i-iv-i', degrees: [0, 3, 0], about: 'keep the shared note' },
  { id: 'i-V-i', degrees: [0, 4, 0], about: 'the leading tone pulls home' },
  { id: 'i-iv-V-i', degrees: [0, 3, 4, 0], maxMove: 3, about: 'the minor cadence' },
  {
    id: 'i-iv-V-i-bass',
    degrees: [0, 3, 4, 0],
    twoHands: true,
    maxMove: 3,
    about: 'left hand on the roots',
  },
  { id: 'i-VI-III-VII', degrees: [0, 5, 2, 6], about: 'epic pop' },
  { id: 'i-VII-VI-V', degrees: [0, 6, 5, 4], about: 'the Andalusian cadence' },
  { id: 'i-VI-VII-i', degrees: [0, 5, 6, 0], about: 'climbing home' },
  { id: 'ii-V-i', degrees: [1, 4, 0], maxMove: 3, about: 'the minor jazz cadence' },
];

export function minorProgressionsLevel(circleKey: Key): Level {
  const key = spellableMinor(circleKey);
  const natural = harmonicTriads(key);
  const leading = harmonicMinorScale(key)[6];
  if (leading === undefined) throw new RangeError('scale is not 7 notes');
  return {
    ...levelBase(key, 'minor-prog', 'Minor progressions with the raised 7th.'),
    extraNotes: [leading],
    note: `**V** is major: its 3rd is the raised 7th, **${pretty(leading)}**, a half step below home. Each note moves **at most a whole step**, except into V from iv or ii°: one note there may move a **minor 3rd**.`,
    steps: MINOR_PROGRESSIONS.map((def) => {
      const chords = def.degrees.map((d) => triadAt(natural, d));
      return progressionStep({
        id: def.id,
        name: `${chords.map((t) => t.short).join(' – ')} · ${def.about}`,
        chords: chords.map((t) => ({ chord: chordFromTriad(t) })),
        twoHands: def.twoHands === true,
        maxMove: def.maxMove ?? MAX_MOVE,
      });
    }),
  };
}

export function minorProgressions(): Track {
  return {
    id: 'minor-progressions',
    title: 'Minor progressions',
    blurb:
      'Smooth progressions in minor keys, with the major V that makes minor resolve. One key per level.',
    group: VOICE_LEADING_GROUP,
    map: 'circle-of-fifths',
    available: true,
    lesson: minorProgressionsLesson(),
    levels: CIRCLE_MINOR.map((tonic) => minorProgressionsLevel({ tonic, mode: 'minor' })),
  };
}
