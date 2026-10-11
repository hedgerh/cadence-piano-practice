// Ear fixtures built from real content (no React): dev screens and unit tests share them.
import { earTraining, type Level, type Stage } from '@cadence/content';
import type { EarSession } from './earDrillReducer';
import type { CompleteDto } from './useEarDrill';

/** EarInterval:103 — results [right, right, missed], question 4 is C → F (P4). */
export const INTERVAL_ORDER = ['P5', 'M3', 'm3', 'P4', 'M2', 'P8', 'P1', 'M3', 'P5', 'P4'] as const;

export function levelOf(levelId: string): { level: Level; stage: Stage } {
  for (const stage of earTraining().stages ?? []) {
    const level = stage.levels.find((l) => l.id === levelId);
    if (level) return { level, stage };
  }
  throw new Error(`no ear level ${levelId}`);
}

export interface Answered {
  stepId: string;
  chosen: string;
}

/** A SessionDto for `levelId` whose questions are `stepIds`; `answered` are recorded already. */
export function earSessionFixture(
  levelId: string,
  stepIds: readonly string[],
  answered: readonly Answered[] = [],
): EarSession {
  const { level, stage } = levelOf(levelId);
  const pool = level.pool ?? [];
  const questions = stepIds.map((id, ordinal) => {
    const step = pool.find((s) => s.id === id);
    if (!step) throw new Error(`no step ${id} in ${levelId}`);
    return { ...step, ordinal };
  });
  return {
    sessionId: `dev-${levelId}`,
    focus: null,
    run: null,
    runProgress: null,
    trackId: 'ear-training',
    trackTitle: 'Ear training',
    levelId,
    levelTitle: level.title,
    levelNote: level.note ?? null,
    shortTitle: `${stage.title} · ${level.title}`,
    stageTitle: stage.title,
    kind: 'learn',
    isEar: true,
    planBlockId: null,
    startedAt: 0,
    finishedAt: null,
    resumed: false,
    visibility: 'all',
    pass: level.pass ?? { correct: 8, of: 10 },
    steps: [],
    questions,
    results: answered.map((a, ordinal) => {
      const q = questions[ordinal];
      const correct = q?.match.type === 'choice' && q.match.answer === a.chosen;
      return {
        ordinal,
        stepId: a.stepId,
        result: correct ? ('clean' as const) : ('wrong' as const),
        hintLevel: 0,
        chosen: a.chosen,
        tries: null,
        playedBack: false,
        elapsedMs: 3000,
      };
    }),
  };
}

/**
 * Intervals L3 finished: 9 of 10 (pass, Level 4 next) or 6 of 10 (fail). `missed` overrides the
 * missed ordinals; `focus` makes it a focus round (engine.md §4: never passed, no level XP).
 */
export function earCompleteFixture(
  passArg: boolean,
  /** `last`: a pass with nothing next (stage finished, next stage locked). */
  opts: { missed?: readonly number[]; focus?: boolean; last?: boolean } = {},
): CompleteDto {
  const order = INTERVAL_ORDER;
  const focus = opts.focus ?? false;
  const pass = passArg && !focus;
  const missed = new Set(opts.missed ?? (passArg ? [2] : [1, 2, 5, 8]));
  const { level } = levelOf('intervals-3');
  const chips: CompleteDto['chips'] = order.map((iv, ordinal) => {
    const step = (level.pool ?? []).find((s) => s.id === `up-C4-${iv}`);
    return {
      ordinal,
      stepId: `up-C4-${iv}`,
      label: iv,
      short: step?.name ?? iv,
      quality: null,
      result: missed.has(ordinal) ? 'wrong' : 'clean',
    };
  });
  const correct = order.length - missed.size;
  const steps = 5 * correct;
  return {
    sessionId: 'dev-ear-results',
    focus: focus ? 'misses' : null,
    run: null,
    runPosition: null,
    kind: focus ? 'free' : 'learn',
    trackId: 'ear-training',
    levelId: 'intervals-3',
    levelTitle: 'Level 3',
    shortTitle: 'Intervals · Level 3',
    isEar: true,
    stepNoun: 'step',
    title: focus
      ? 'Focus round'
      : pass
        ? 'Intervals · Level 3, passed'
        : `Not yet — ${correct} of 10`,
    subtitle: focus ? `${correct} of 10 right.` : `${correct} of 10 correct.`,
    completed: pass,
    passed: pass,
    firstCompletion: pass,
    durationMs: 151_000,
    total: 10,
    cleanCount: correct,
    hintedCount: 0,
    skippedCount: 0,
    markedCount: 0,
    wrongCount: missed.size,
    correct,
    pass: { correct: 8, of: 10 },
    chips,
    xp: {
      level: pass ? 40 : 0,
      steps,
      playback: 10,
      total: (pass ? 40 : 0) + steps + 10,
      newTotal: 1240 + (pass ? 40 : 0) + steps + 10,
    },
    streak: { days: 8, keptToday: true, atRisk: false },
    track: {
      id: 'ear-training',
      title: 'Ear training',
      done: pass ? 3 : 2,
      total: 20,
      unit: 'levels',
      nextLevelId: pass ? 'intervals-4' : 'intervals-3',
      nextTitle: pass ? 'Level 4' : 'Level 3',
    },
    reviewNote: pass
      ? "Minor 3rd will come back in tomorrow's review until it's clean."
      : 'Major 3rd, Minor 3rd, Octave and Perfect 5th come back tomorrow.',
    next:
      pass && opts.last !== true
        ? {
            levelId: 'intervals-4',
            label: 'Keep going — Level 4',
            route: '/ear/intervals-4',
            run: null,
          }
        : null,
    levelStatus: pass ? 'completed' : 'in_progress',
  };
}
