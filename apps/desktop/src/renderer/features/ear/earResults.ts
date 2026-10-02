// `/ear/results/:sessionId` view model (docs/ui.md §3 "EarResults": the Complete.dc.html
// composition). Pass: teal check, per-question chip strip, +40 XP, "Keep going — Level 4".
// Fail: lavender circle, "Not yet — 6 of 10", "Try Level 3 again". No red anywhere.
// Either, with a miss: "Drill what you missed" starts a focus round (engine.md §4 focus rounds).
// Focus round results: "Focus round", "n of 10 right", no judgement and no +40 tile; "Drill
// again" / "Back to Level 3" (docs/decisions.md "Adaptive ear selection and focus rounds").
// A pass also offers "Practice Level 3 again" (a review session on the same level); with nothing
// next, that becomes the primary and "Back to the map" the secondary (decisions.md "Ear level
// replay").
import { pretty } from '@cadence/music';
import { formatDuration } from '../complete/complete';
import type { CompleteDto } from './useEarDrill';

export type EarResultsAction =
  | { kind: 'next'; label: string; levelId: string }
  | { kind: 'retry'; label: string; levelId: string }
  /** After a pass: a `review` session on the same level (the level stays passed). */
  | { kind: 'practice'; label: string; levelId: string }
  /** The track map: `/tracks/:trackId`. */
  | { kind: 'map'; label: string; to: string }
  /** Start a focus round on the level (`sessions.start` with `focus: 'misses'`). */
  | { kind: 'drill'; label: string; levelId: string }
  /** From a focus round: a normal session on the level. */
  | { kind: 'back'; label: string; levelId: string }
  | { kind: 'done'; label: string };

export interface EarResultChip {
  key: string;
  label: string;
  /** Teal = right, lavender = missed (engine.md §6.12 — never red). */
  tone: 'teal' | 'lavender';
  title: string;
}

export interface EarResultsView {
  /** pass / fail judge the level; focus rounds are not judged. */
  result: 'pass' | 'fail' | 'focus';
  passed: boolean;
  title: string;
  subtitle: string;
  chips: EarResultChip[];
  stats: ReadonlyArray<{ value: string; label: string; tone: 'ground' | 'lavender' }>;
  reviewNote: string;
  primary: EarResultsAction;
  secondary: EarResultsAction;
  /** TextButton beside the primary: "Practice Level 3 again" after a pass with a next level. */
  extra: EarResultsAction | null;
  /** "Drill what you missed" — only when a normal session had a wrong or hinted answer. */
  drill: EarResultsAction | null;
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

const isMiss = (result: CompleteDto['chips'][number]['result']): boolean =>
  result === 'wrong' || result === 'hinted';

export function earResultsView(dto: CompleteDto): EarResultsView {
  const correct = dto.correct ?? dto.cleanCount + dto.hintedCount;
  const total = dto.total;
  const chips: EarResultChip[] = dto.chips.map((c) => ({
    key: `${c.ordinal}-${c.stepId}`,
    label: SHORT_LABEL[c.label] ?? pretty(c.label),
    tone: c.result === 'clean' || c.result === 'hinted' ? 'teal' : 'lavender',
    title: pretty(c.short),
  }));
  const time = {
    value: formatDuration(dto.durationMs),
    label: 'time, no tempo',
    tone: 'ground',
  } as const;
  const answerXp = {
    value: `+${dto.xp.total} XP`,
    label: 'for your answers',
    tone: 'lavender',
  } as const;

  if (dto.focus !== null) {
    return {
      result: 'focus',
      passed: false,
      title: 'Focus round',
      subtitle: `${correct} of ${total} right. Every answer still counts toward review.`,
      chips,
      stats: [
        time,
        { value: `${correct} of ${total}`, label: 'named right', tone: 'ground' },
        answerXp,
      ],
      reviewNote: dto.reviewNote,
      primary: { kind: 'drill', label: 'Drill again', levelId: dto.levelId },
      secondary: { kind: 'back', label: `Back to ${dto.levelTitle}`, levelId: dto.levelId },
      extra: null,
      drill: null,
    };
  }

  const need = dto.pass?.correct ?? 8;
  const passed = dto.passed;
  const practice: EarResultsAction = {
    kind: 'practice',
    label: `Practice ${dto.levelTitle} again`,
    levelId: dto.levelId,
  };
  const map: EarResultsAction = {
    kind: 'map',
    label: 'Back to the map',
    to: `/tracks/${dto.trackId}`,
  };
  let primary: EarResultsAction;
  let secondary: EarResultsAction = DONE;
  let extra: EarResultsAction | null = null;
  if (!passed) {
    primary = { kind: 'retry', label: `Try ${dto.levelTitle} again`, levelId: dto.levelId };
  } else if (dto.next) {
    primary = { kind: 'next', label: dto.next.label, levelId: dto.next.levelId };
    extra = practice;
  } else {
    // Stage finished with the next stage locked, or nothing left: stay on this level.
    primary = practice;
    secondary = map;
  }

  return {
    result: passed ? 'pass' : 'fail',
    passed,
    title: dto.title,
    subtitle: passed
      ? `${correct} of ${total} right. Nice ears.`
      : `${correct} of ${total} right — ${need} passes. The ones you missed come back in review.`,
    chips,
    stats: [
      time,
      {
        value: `${correct} of ${total}`,
        label: passed ? 'named right' : `${need} needed to pass`,
        tone: 'ground',
      },
      // engine.md §4 XpService: the tile shows the level bonus (+40) when passed, as designed.
      passed
        ? { value: `+${dto.xp.level} XP`, label: streakLabel(dto.streak), tone: 'lavender' }
        : answerXp,
    ],
    reviewNote: dto.reviewNote,
    primary,
    secondary,
    extra,
    drill: dto.chips.some((c) => isMiss(c.result))
      ? { kind: 'drill', label: 'Drill what you missed', levelId: dto.levelId }
      : null,
  };
}
