// 12-bar blues (decisions.md 2026-10-18 "12-bar blues"): I7, IV7 and V7 in the 12 major keys —
// the shapes, the smooth moves between them (4 voices, each ≤ a whole step), then the 12-bar
// form with one hand and with a left-hand root. The ♭3 and ♭7 the dominants bring are declared
// in `extraNotes`. G♭'s IV7 would be C♭7 (B𝄫), so that slot uses F♯ major.
import {
  CIRCLE_MAJOR,
  type Key,
  type Seventh,
  dominantSeventhOn,
  pcName,
  pcNumber,
  scale,
} from '@cadence/music';
import { bluesLesson } from '../lessons/blues';
import type { Level, Step, Track } from '../types';
import { chordFromSeventh, levelBase, progressionStep } from './levelBits';
import { BLUES_GROUP } from './pentatonicTracks';
import { MAX_MOVE } from './voiceLeadingTracks';

/** I7, IV7 and V7 of `key`. */
function dominants(key: Key): [Seventh, Seventh, Seventh] {
  const names = scale(key);
  const at = (i: number) => names[i] ?? key.tonic;
  return [dominantSeventhOn(at(0), 1), dominantSeventhOn(at(3), 4), dominantSeventhOn(at(4), 5)];
}

/** `key`, or its sharp-side twin when a dominant would need a double flat (G♭ → F♯). */
export function spellableBlues(key: Key): Key {
  try {
    dominants(key);
    return key;
  } catch {
    return { tonic: pcName(pcNumber(key.tonic), 'sharps'), mode: key.mode };
  }
}

type Chord = 'I' | 'IV' | 'V';
interface BluesLine {
  id: string;
  chords: readonly Chord[];
  twoHands?: boolean;
  about: string;
}

/** The 12-bar form with repeated bars collapsed (a held chord can't be played "again"). */
const FORM: readonly Chord[] = ['I', 'IV', 'I', 'V', 'IV', 'I'];
const QUICK_CHANGE: readonly Chord[] = ['I', 'IV', 'I', 'IV', 'I', 'V', 'IV', 'I'];

export const BLUES_LINES: readonly BluesLine[] = [
  { id: 'I-IV-I', chords: ['I', 'IV', 'I'], about: 'two notes step, two stay close' },
  { id: 'V-IV-I', chords: ['V', 'IV', 'I'], about: 'the end of the form' },
  {
    id: 'form',
    chords: FORM,
    about: 'bars 1–4 I7 · 5–6 IV7 · 7–8 I7 · 9 V7 · 10 IV7 · 11–12 I7',
  },
  {
    id: 'form-bass',
    chords: FORM,
    twoHands: true,
    about: 'the whole form, left hand on the roots',
  },
  {
    id: 'quick-change',
    chords: QUICK_CHANGE,
    twoHands: true,
    about:
      'quick change: IV7 in bar 2 · bars 1 I7 · 2 IV7 · 3–4 I7 · 5–6 IV7 · 7–8 I7 · 9 V7 · 10 IV7 · 11–12 I7',
  },
];

export function bluesLevel(circleKey: Key): Level {
  const key = spellableBlues(circleKey);
  const [I, IV, V] = dominants(key);
  const byName: Record<Chord, Seventh> = { I, IV, V };
  const inKey = new Set(scale(key).map(pcNumber));
  const extra = [
    ...new Set([I, IV, V].flatMap((s) => [s.root, s.third, s.fifth, s.seventh])),
  ].filter((pc) => !inKey.has(pcNumber(pc)));
  const shapes: Step[] = [I, IV, V].map((s, i) => ({
    id: ['I7', 'IV7', 'V7'][i] ?? s.numeral,
    label: s.numeral,
    name: s.name,
    quality: 'major',
    match: { type: 'chord', notes: [s.root, s.third, s.fifth, s.seventh] },
  }));
  return {
    ...levelBase(key, 'blues', `12-bar blues: ${I.short} · ${IV.short} · ${V.short}`),
    extraNotes: extra,
    note: `Every chord is a **dominant 7th**: ${I.short}, ${IV.short} and ${V.short}. Each note moves **at most a whole step**.`,
    steps: [
      ...shapes,
      ...BLUES_LINES.map((line) =>
        progressionStep({
          id: line.id,
          name: `${line.chords.map((c) => byName[c].short).join(' – ')} · ${line.about}`,
          chords: line.chords.map((c) => ({ chord: chordFromSeventh(byName[c]) })),
          twoHands: line.twoHands === true,
          maxMove: MAX_MOVE,
        }),
      ),
    ],
  };
}

export function twelveBarBlues(): Track {
  return {
    id: 'twelve-bar-blues',
    title: '12-bar blues',
    blurb:
      'Three dominant 7th chords and twelve bars: the form behind blues, rock and roll and a lot of jazz. One key per level.',
    group: BLUES_GROUP,
    map: 'circle-of-fifths',
    available: true,
    lesson: bluesLesson(),
    levels: CIRCLE_MAJOR.map((tonic) => bluesLevel({ tonic, mode: 'major' })),
  };
}
