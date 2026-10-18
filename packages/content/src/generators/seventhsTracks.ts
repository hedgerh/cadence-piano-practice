// The "7th chords" group (decisions.md 2026-10-18 "7th chords"), 12 major keys each:
//   - Diatonic 7th chords: each of Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7, any octave, any
//     inversion (`chord` with four notes).
//   - ii–V–I: four-voice smooth progressions (`progression`, every voice ≤ a whole step), where
//     each 7th steps down to the next chord's 3rd; right hand, then with a left-hand root.
import { CIRCLE_MAJOR, type Key, diatonicSevenths, type Seventh } from '@cadence/music';
import { seventhsLesson, twoFiveOneLesson } from '../lessons/sevenths';
import type { Level, Track } from '../types';
import { chordFromSeventh, levelBase, progressionStep } from './levelBits';
import { MAX_MOVE } from './voiceLeadingTracks';

export const SEVENTHS_GROUP = '7th chords';

function seventhAt(sevenths: readonly Seventh[], degree: number): Seventh {
  const s = sevenths[degree];
  if (s === undefined) throw new RangeError(`no 7th chord on degree ${degree + 1}`);
  return s;
}

export function diatonicSeventhsLevel(key: Key): Level {
  const sevenths = diatonicSevenths(key);
  return {
    ...levelBase(key, 'sevenths', `7th chords: ${sevenths.map((s) => s.short).join(' · ')}`),
    note: 'Four notes: root, 3rd, 5th and **7th**. Any octave, any order.',
    steps: sevenths.map((s, i) => ({
      id: `d${i + 1}`,
      label: s.numeral,
      name: s.name,
      quality: s.triadQuality,
      match: { type: 'chord', notes: [s.root, s.third, s.fifth, s.seventh] },
    })),
  };
}

export function diatonicSeventhChords(): Track {
  return {
    id: 'diatonic-sevenths',
    title: 'Diatonic 7th chords',
    blurb:
      'Add one more third: the seven 7th chords of each major key, from Imaj7 to viiø7. One key per level.',
    group: SEVENTHS_GROUP,
    map: 'circle-of-fifths',
    available: true,
    lesson: seventhsLesson(),
    levels: CIRCLE_MAJOR.map((tonic) => diatonicSeventhsLevel({ tonic, mode: 'major' })),
  };
}

interface SeventhProgressionDef {
  id: string;
  degrees: readonly number[];
  /** Inversion of the first chord (right hand only). */
  start?: number;
  twoHands?: boolean;
  about: string;
}

/** ii–V–I and the I–vi–ii–V turnaround, right hand first, then with a left-hand root. */
export const TWO_FIVE_ONES: readonly SeventhProgressionDef[] = [
  { id: 'ii-V', degrees: [1, 4], about: 'the 7th falls to the 3rd' },
  { id: 'ii-V-I', degrees: [1, 4, 0], about: 'from root position' },
  { id: 'ii-V-I-first', degrees: [1, 4, 0], start: 1, about: 'from ii7 with its 3rd lowest' },
  { id: 'ii-V-I-bass', degrees: [1, 4, 0], twoHands: true, about: 'left hand on the roots' },
  { id: 'turnaround', degrees: [0, 5, 1, 4], about: 'the turnaround' },
  { id: 'turnaround-bass', degrees: [0, 5, 1, 4], twoHands: true, about: 'left hand on the roots' },
];

export function twoFiveOneLevel(key: Key): Level {
  const sevenths = diatonicSevenths(key);
  return {
    ...levelBase(key, '251', 'ii–V–I with 7ths: the 7th of each chord steps down to the next 3rd.'),
    note: 'Four notes per chord, each moving **at most a whole step**. The 7th steps **down** to the next chord’s 3rd.',
    steps: TWO_FIVE_ONES.map((def) => {
      const chords = def.degrees.map((d) => seventhAt(sevenths, d));
      return progressionStep({
        id: def.id,
        name: `${chords.map((s) => s.short).join(' – ')} · ${def.about}`,
        chords: chords.map((s, i) => ({
          chord: chordFromSeventh(s),
          ...(i === 0 && def.start !== undefined ? { inv: def.start } : {}),
        })),
        twoHands: def.twoHands === true,
        maxMove: MAX_MOVE,
      });
    }),
  };
}

export function twoFiveOne(): Track {
  return {
    id: 'two-five-one',
    title: 'ii–V–I',
    blurb:
      'The progression jazz is built on, with 7th chords: four voices moving smoothly, each 7th falling to the next 3rd. One key per level.',
    group: SEVENTHS_GROUP,
    map: 'circle-of-fifths',
    available: true,
    lesson: twoFiveOneLesson(),
    levels: CIRCLE_MAJOR.map((tonic) => twoFiveOneLevel({ tonic, mode: 'major' })),
  };
}
