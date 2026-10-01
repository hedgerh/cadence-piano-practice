// Practice.dc.html — A major, I and ii done, iii current (Practice:136–147).
import type { Note } from '@cadence/music';
import type { RomanChipState } from '../../components/ui/RomanChip';
import type { Segment } from '../../components/ui/SegmentedProgress';
import type { ShowMe } from '../../components/ui/ShowMeControl';

export interface PracticeChord {
  numeral: string;
  name: string;
  short: string;
  notes: string[];
  keys: Note[];
}

/** Practice:139–147 */
export const aMajorChords: PracticeChord[] = [
  { numeral: 'I', name: 'A major', short: 'A', notes: ['A', 'C♯', 'E'], keys: ['A3', 'C#4', 'E4'] },
  {
    numeral: 'ii',
    name: 'B minor',
    short: 'Bm',
    notes: ['B', 'D', 'F♯'],
    keys: ['B3', 'D4', 'F#4'],
  },
  {
    numeral: 'iii',
    name: 'C♯ minor',
    short: 'C♯m',
    notes: ['C♯', 'E', 'G♯'],
    keys: ['C#4', 'E4', 'G#4'],
  },
  {
    numeral: 'IV',
    name: 'D major',
    short: 'D',
    notes: ['D', 'F♯', 'A'],
    keys: ['D3', 'F#3', 'A3'],
  },
  { numeral: 'V', name: 'E major', short: 'E', notes: ['E', 'G♯', 'B'], keys: ['E3', 'G#3', 'B3'] },
  {
    numeral: 'vi',
    name: 'F♯ minor',
    short: 'F♯m',
    notes: ['F♯', 'A', 'C♯'],
    keys: ['F#3', 'A3', 'C#4'],
  },
  {
    numeral: 'vii°',
    name: 'G♯ diminished',
    short: 'G♯°',
    notes: ['G♯', 'B', 'D'],
    keys: ['G#3', 'B3', 'D4'],
  },
];

/** Practice:136 — `{ vis: 'all', hint: 0, current: 2, done: [0, 1], skipped: [] }`. */
export const practiceState = {
  vis: 'all' as ShowMe,
  hint: 0 as 0 | 1 | 2,
  current: 2,
  done: [0, 1],
  skipped: [] as number[],
};

export function chordStates(s: typeof practiceState): RomanChipState[] {
  return aMajorChords.map((_, i) =>
    s.done.includes(i)
      ? 'done'
      : s.skipped.includes(i)
        ? 'skipped'
        : i === s.current
          ? 'current'
          : 'upcoming',
  );
}

/** Practice:183–186 */
export function chordSegments(s: typeof practiceState): Segment[] {
  return aMajorChords.map((_, i) =>
    s.done.includes(i) ? 'done' : i === s.current ? 'current' : 'empty',
  );
}

export const practiceFixture = {
  header: { back: 'Today', title: 'A major', eyebrow: 'Learn · diatonic chords' },
  /** Practice:192 */
  hintLabels: ['Give me a hint', 'Show it on the keys', 'That is all the hints'] as const,
  keyboardCaption: 'Keys light up as you play. Hints light up the target.',
  listening: "Listening — play it whenever you're ready",
  markPlayed: 'No keyboard? Mark as played',
  skip: 'Skip for now',
  finished: {
    title: 'All seven. Nice.',
    body: 'A major is in your hands now.',
    cta: 'Finish the key',
  },
} as const;
