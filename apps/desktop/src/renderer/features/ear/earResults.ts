// `/ear/results/:sessionId` view model (docs/ui.md §3 "EarResults": the Complete.dc.html
// composition). Pass: teal check, per-question chip strip, +40 XP, "Keep going — Level 4".
// Fail: lavender circle, "Not yet — 6 of 10", "Try Level 3 again". No red anywhere.
import { pretty } from '@cadence/music';
import { formatDuration } from '../complete/complete';
import type { CompleteDto } from './useEarDrill';

export type EarResultsAction =
  | { kind: 'next'; label: string; levelId: string }
  | { kind: 'retry'; label: string; levelId: string }
  | { kind: 'done'; label: string };

export interface EarResultChip {
  key: string;
  label: string;
  /** Teal = right, lavender = missed (engine.md §6.12 — never red). */
  tone: 'teal' | 'lavender';
  title: string;
}

export interface EarResultsView {
  passed: boolean;
  title: string;
  subtitle: string;
  chips: EarResultChip[];
  stats: ReadonlyArray<{ value: string; label: string; tone: 'ground' | 'lavender' }>;
  reviewNote: string;
  primary: EarResultsAction;
  secondary: EarResultsAction;
}

/** Chord-quality labels are words; the strip shows them short so ten chips fit. */
const SHORT_LABEL: Readonly<Record<string, string>> = {
  major: 'Maj',
  minor: 'Min',
  diminished: 'Dim',
};

const DONE: EarResultsAction = { kind: 'done', label: 'Done for today' };

/** Complete:59 — "day 8 streak kept". */
function streakLabel(streak: CompleteDto['streak']): string {
  return streak.keptToday ? `day ${streak.days} streak kept` : `day ${streak.days} streak`;
}

export function earResultsView(dto: CompleteDto): EarResultsView {
  const correct = dto.correct ?? dto.cleanCount + dto.hintedCount;
  const total = dto.total;
  const need = dto.pass?.correct ?? 8;
  const passed = dto.passed;
  const primary: EarResultsAction = passed
    ? dto.next
      ? { kind: 'next', label: dto.next.label, levelId: dto.next.levelId }
      : DONE
    : { kind: 'retry', label: `Try ${dto.levelTitle} again`, levelId: dto.levelId };
  const secondary: EarResultsAction =
    primary.kind === 'done'
      ? { kind: 'retry', label: 'Play it again', levelId: dto.levelId }
      : DONE;

  return {
    passed,
    title: dto.title,
    subtitle: passed
      ? `${correct} of ${total} right. Nice ears.`
      : `${correct} of ${total} right — ${need} passes. The ones you missed come back in review.`,
    chips: dto.chips.map((c) => ({
      key: `${c.ordinal}-${c.stepId}`,
      label: SHORT_LABEL[c.label] ?? pretty(c.label),
      tone: c.result === 'clean' || c.result === 'hinted' ? 'teal' : 'lavender',
      title: pretty(c.short),
    })),
    stats: [
      { value: formatDuration(dto.durationMs), label: 'time, no tempo', tone: 'ground' },
      {
        value: `${correct} of ${total}`,
        label: passed ? 'named right' : `${need} needed to pass`,
        tone: 'ground',
      },
      // engine.md §4 XpService: the tile shows the level bonus (+40) when passed, as designed.
      passed
        ? { value: `+${dto.xp.level} XP`, label: streakLabel(dto.streak), tone: 'lavender' }
        : { value: `+${dto.xp.total} XP`, label: 'for your answers', tone: 'lavender' },
    ],
    reviewNote: dto.reviewNote,
    primary,
    secondary,
  };
}
