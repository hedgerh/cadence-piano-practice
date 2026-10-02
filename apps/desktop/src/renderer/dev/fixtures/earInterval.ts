// EarInterval.dc.html — Intervals L3, results [true, true, false], target P4, chosen M3.
import type { AnswerChipState } from '../../components/ui/AnswerChip';
import type { Segment } from '../../components/ui/SegmentedProgress';

/** EarInterval:119–133 */
export const INTERVALS = [
  { id: 'P1', short: 'P1', name: 'Unison', semis: 0, note: 'C' },
  { id: 'm2', short: 'm2', name: 'Minor 2nd', semis: 1, note: 'C♯' },
  { id: 'M2', short: 'M2', name: 'Major 2nd', semis: 2, note: 'D' },
  { id: 'm3', short: 'm3', name: 'Minor 3rd', semis: 3, note: 'E♭' },
  { id: 'M3', short: 'M3', name: 'Major 3rd', semis: 4, note: 'E' },
  { id: 'P4', short: 'P4', name: 'Perfect 4th', semis: 5, note: 'F' },
  { id: 'TT', short: 'TT', name: 'Tritone', semis: 6, note: 'F♯' },
  { id: 'P5', short: 'P5', name: 'Perfect 5th', semis: 7, note: 'G' },
  { id: 'm6', short: 'm6', name: 'Minor 6th', semis: 8, note: 'A♭' },
  { id: 'M6', short: 'M6', name: 'Major 6th', semis: 9, note: 'A' },
  { id: 'm7', short: 'm7', name: 'Minor 7th', semis: 10, note: 'B♭' },
  { id: 'M7', short: 'M7', name: 'Major 7th', semis: 11, note: 'B' },
  { id: 'P8', short: 'P8', name: 'Octave', semis: 12, note: 'C' },
] as const;

/** EarInterval:134 */
export const ACTIVE: readonly string[] = ['P1', 'M2', 'm3', 'M3', 'P4', 'P5', 'P8'];

/** EarInterval:103 */
export const earIntervalState = {
  target: 'P4',
  chosen: 'M3',
  q: 3,
  results: [true, true, false],
} as const;

/** EarInterval:143–156 */
export function intervalChipState(id: string, answered: boolean): AnswerChipState {
  if (!ACTIVE.includes(id)) return 'inactive';
  if (!answered) return 'active';
  if (id === earIntervalState.target) return 'correct';
  if (id === earIntervalState.chosen) return 'chosen-wrong';
  return 'dimmed';
}

/** EarInterval:158–164 */
export function intervalSegments(): Segment[] {
  return Array.from({ length: 10 }, (_, i): Segment => {
    const r = earIntervalState.results[i];
    if (r !== undefined) return r ? 'done' : 'wrong';
    return i === earIntervalState.q ? 'current' : 'empty';
  });
}

export const earIntervalFixture = {
  header: {
    back: 'Ear training',
    title: 'Intervals · Level 3',
    eyebrow: 'Name it, then play it back',
  },
  /** EarInterval:45 */
  progress: '2 right · question 4 of 10',
  play: 'Play',
  playAgain: 'Hear it again',
  prompt: 'Two notes, going up. The first one is always C.',
  greyed: 'Greyed-out intervals arrive in later levels.',
  /** EarInterval:189–191, chosen M3 vs target P4. */
  feedbackWrong: {
    title: 'Not quite. That was a perfect 4th.',
    body: "C up to F. 'Here Comes the Bride' — the first two notes. You said major 3rd — it will come back in review.",
    playback: 'C then F',
  },
  feedbackRight: {
    title: 'Perfect 4th — yes.',
    body: "C up to F. 'Here Comes the Bride' — the first two notes. Nice ears.",
    playback: 'C then F',
  },
  /** Lit keys for C → F on the one-octave keyboard (C4, F4). */
  litKeys: ['C4', 'F4'],
} as const;
