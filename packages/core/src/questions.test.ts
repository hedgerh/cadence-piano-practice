import type { Step } from '@cadence/content';
import { describe, expect, it } from 'vitest';
import type { StepProgressRow } from './ports';
import { answerOf, createRng, orderViolations, prioritize, selectQuestions } from './questions';
import { testContent } from './testing/harness';

const pool = (levelId: string): Step[] => testContent().requireLevel(levelId).level.pool ?? [];

function row(stepId: string, patch: Partial<StepProgressRow>): StepProgressRow {
  return {
    id: stepId,
    trackId: 'ear-training',
    levelId: 'x',
    stepId,
    intervalIndex: 0,
    intervalDays: 1,
    dueOn: '2026-10-05',
    lastResult: 'clean',
    lastSeenAt: 0,
    timesSeen: 1,
    timesClean: 1,
    timesHinted: 0,
    timesWrong: 0,
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

// engine.md §4 Question selection.
describe('question selection', () => {
  const today = '2026-10-01';

  it('puts due steps first, then never-seen, then times_wrong desc / last_seen_at asc', () => {
    const steps = pool('intervals-4'); // 10 steps
    const [a, b, c, d, e] = steps.map((s) => s.id);
    const progress = [
      row(a ?? '', { dueOn: '2026-09-30' }),
      row(b ?? '', { dueOn: '2026-09-28' }),
      row(c ?? '', { dueOn: '2026-10-09', timesWrong: 0, lastSeenAt: 5 }),
      row(d ?? '', { dueOn: '2026-10-09', timesWrong: 3, lastSeenAt: 9 }),
      row(e ?? '', { dueOn: '2026-10-09', timesWrong: 0, lastSeenAt: 1 }),
    ];
    const ranked = prioritize(steps, progress, today).map((s) => s.id);
    expect(ranked.slice(0, 2)).toEqual([b, a]); // due, earliest first
    expect(ranked.slice(2, 7)).toEqual(steps.slice(5).map((s) => s.id)); // never seen
    expect(ranked.slice(7)).toEqual([d, e, c]);
  });

  it('includes every due step when the pool is larger than pass.of', () => {
    const steps = pool('intervals-5'); // 65 steps
    const due = steps.slice(40, 45).map((s) => row(s.id, { dueOn: today }));
    const seen = steps.map((s) => row(s.id, { dueOn: '2026-12-01' }));
    const progress = [...seen.filter((r) => !due.some((d) => d.stepId === r.stepId)), ...due];
    const chosen = selectQuestions(steps, progress, today, 10, createRng(7)).map((s) => s.id);
    expect(chosen).toHaveLength(10);
    for (const d of due) expect(chosen).toContain(d.stepId);
  });

  it('cycles a small pool up to pass.of with no back-to-back repeats', () => {
    const steps = pool('intervals-1'); // 3 steps
    for (let seed = 1; seed <= 50; seed++) {
      const chosen = selectQuestions(steps, [], today, 10, createRng(seed));
      expect(chosen).toHaveLength(10);
      const counts = new Map<string, number>();
      for (const s of chosen) counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
      expect([...counts.values()].sort()).toEqual([3, 3, 4]);
      for (let i = 1; i < chosen.length; i++) expect(chosen[i]?.id).not.toBe(chosen[i - 1]?.id);
      expect(orderViolations(chosen)).toBe(0);
    }
  });

  it('never has more than two consecutive questions sharing an answer (intervals)', () => {
    const steps = pool('intervals-5'); // 5 roots × 13 intervals: answers repeat across roots
    for (let seed = 1; seed <= 50; seed++) {
      const chosen = selectQuestions(steps, [], today, 10, createRng(seed));
      for (let i = 2; i < chosen.length; i++) {
        const [x, y, z] = [chosen[i - 2], chosen[i - 1], chosen[i]].map((s) =>
          s ? answerOf(s) : '',
        );
        expect(x === y && y === z).toBe(false);
      }
    }
  });

  it('works for 5-question find-the-key levels and two-answer chord quality', () => {
    const key = selectQuestions(pool('find-the-key-1'), [], today, 5, createRng(3));
    expect(key).toHaveLength(5);
    const q = selectQuestions(pool('chord-quality-1'), [], today, 10, createRng(3));
    expect(orderViolations(q)).toBe(0);
  });

  it('is deterministic for a seed', () => {
    const steps = pool('intervals-3');
    const a = selectQuestions(steps, [], today, 10, createRng(42)).map((s) => s.id);
    const b = selectQuestions(steps, [], today, 10, createRng(42)).map((s) => s.id);
    expect(a).toEqual(b);
  });
});
