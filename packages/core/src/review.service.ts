// HANDOFF §5 review scheduling, refined by engine.md §4 ReviewService. Per step, not per
// level: a clean result moves the step out along INTERVALS; anything else brings it back
// tomorrow. A level is mastered when every step is at 7 days or more.
import type { Level, Step } from '@cadence/content';
import { triadShort } from '@cadence/music';
import { type ServiceContext, joinAnd, numberWord, todayOf } from './context';
import { addDays } from './dates';
import type { DueCount, StepProgressRow, StepProgressUpsert, StepResult } from './ports';

export const INTERVALS = [1, 3, 7, 14, 30] as const;
export const MASTERY_DAYS = 7;

export interface ScheduleInput {
  prev: StepProgressRow | null;
  trackId: string;
  levelId: string;
  stepId: string;
  result: StepResult;
  today: string;
  now: number;
  /**
   * The step was already recorded earlier in the same session (ear pools cycle). A repeated
   * clean answer does not advance the interval a second time; a repeated miss still resets.
   */
  repeatInSession?: boolean;
}

/** Pure scheduler (engine.md §4): clean → idx+1 (max 4), due today+INTERVALS[idx]; else reset. */
export function schedule(input: ScheduleInput): StepProgressUpsert {
  const { prev, result, today, now } = input;
  const base: StepProgressUpsert = {
    trackId: input.trackId,
    levelId: input.levelId,
    stepId: input.stepId,
    intervalIndex: prev?.intervalIndex ?? -1,
    intervalDays: prev?.intervalDays ?? 0,
    dueOn: prev?.dueOn ?? null,
    lastResult: result,
    lastSeenAt: now,
    timesSeen: (prev?.timesSeen ?? 0) + 1,
    timesClean: prev?.timesClean ?? 0,
    timesHinted: prev?.timesHinted ?? 0,
    timesWrong: prev?.timesWrong ?? 0,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  if (result === 'clean') {
    base.timesClean++;
    if (input.repeatInSession && prev) return base;
    const idx = Math.min((prev?.intervalIndex ?? -1) + 1, INTERVALS.length - 1);
    const days = INTERVALS[idx] ?? 1;
    return { ...base, intervalIndex: idx, intervalDays: days, dueOn: addDays(today, days) };
  }
  if (result === 'hinted') base.timesHinted++;
  if (result === 'wrong') base.timesWrong++;
  return { ...base, intervalIndex: -1, intervalDays: 1, dueOn: addDays(today, 1) };
}

/** Display name of a step in review copy: "G♯°" for chord steps, otherwise the step name. */
export function stepShort(step: Step): string {
  if (step.match.type === 'chord' && step.quality) {
    const root = step.match.notes[0];
    if (root) return triadShort(root, step.quality);
  }
  return step.name;
}

export interface ReviewNoteResult {
  stepId: string;
  result: StepResult;
}

export interface ReviewService {
  record(input: {
    trackId: string;
    levelId: string;
    stepId: string;
    result: StepResult;
    repeatInSession?: boolean;
  }): StepProgressRow;
  /** Every step of the level has interval_days ≥ 7. */
  mastered(levelId: string): boolean;
  dueSteps(today?: string): StepProgressRow[];
  dueCountByLevel(today?: string): DueCount[];
  reviewNote(level: Level, results: readonly ReviewNoteResult[], nextReviewDays: number): string;
}

export function createReviewService(ctx: ServiceContext): ReviewService {
  const { repos, content, clock } = ctx;

  return {
    record({ trackId, levelId, stepId, result, repeatInSession }) {
      const prev = repos.stepProgress.get(levelId, stepId);
      const row = schedule({
        prev,
        trackId,
        levelId,
        stepId,
        result,
        today: todayOf(ctx),
        now: clock.now(),
        ...(repeatInSession === undefined ? {} : { repeatInSession }),
      });
      return repos.stepProgress.upsert(row);
    },

    mastered(levelId) {
      const ref = content.requireLevel(levelId);
      const steps = content.stepsOf(ref.level);
      if (steps.length === 0) return false;
      const rows = new Map(repos.stepProgress.listByLevel(levelId).map((r) => [r.stepId, r]));
      return steps.every((s) => (rows.get(s.id)?.intervalDays ?? 0) >= MASTERY_DAYS);
    },

    dueSteps: (today = todayOf(ctx)) => repos.stepProgress.listDue(today),
    dueCountByLevel: (today = todayOf(ctx)) => repos.stepProgress.dueCountByLevel(today),

    // engine.md §4 reviewNote copy.
    reviewNote(level, results, nextReviewDays) {
      const steps = new Map(
        [...level.steps, ...(level.pool ?? [])].map((s): [string, Step] => [s.id, s]),
      );
      const seen: string[] = [];
      const missed = new Set<string>();
      for (const r of results) {
        if (!seen.includes(r.stepId)) seen.push(r.stepId);
        if (r.result !== 'clean') missed.add(r.stepId);
      }
      if (seen.length === 0) return '';
      const name = (id: string): string => {
        const step = steps.get(id);
        return step ? stepShort(step) : id;
      };
      const names = seen.filter((id) => missed.has(id)).map(name);
      if (names.length === 0) {
        const when = nextReviewDays <= 1 ? 'tomorrow' : `in ${nextReviewDays} days`;
        const subject =
          seen.length === 1 ? `${name(seen[0] ?? '')} is` : `All ${numberWord(seen.length)} are`;
        return `${subject} clean — next review ${when}.`;
      }
      if (names.length === 1) {
        return `${names[0] ?? ''} will come back in tomorrow's review until it's clean.`;
      }
      return `${joinAnd(names)} come back tomorrow.`;
    },
  };
}
