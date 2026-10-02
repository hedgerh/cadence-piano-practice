import type { Step } from '@cadence/content';
import { describe, expect, it } from 'vitest';
import type { StepProgressRow } from './ports';
import {
  answerOf,
  chooseQuestions,
  createRng,
  focusPool,
  orderViolations,
  partition,
  selectQuestions,
} from './questions';
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

  it('partitions into due, unseen, weak, settled and other', () => {
    const steps = pool('intervals-4'); // 10 steps
    const [a, b, c, d, e, f] = steps.map((s) => s.id);
    const progress = [
      row(a ?? '', { dueOn: '2026-09-30' }),
      row(b ?? '', { dueOn: '2026-09-28', lastResult: 'wrong', timesWrong: 1 }),
      row(c ?? '', { dueOn: '2026-10-09', timesWrong: 0, lastSeenAt: 5 }),
      row(d ?? '', { dueOn: '2026-10-09', timesWrong: 3, intervalDays: 3, lastSeenAt: 9 }),
      row(e ?? '', { dueOn: '2026-10-20', intervalDays: 14, intervalIndex: 3 }),
      row(f ?? '', { dueOn: '2026-10-20', intervalDays: 14, timesWrong: 2 }),
    ];
    const ids = (xs: Step[]) => xs.map((s) => s.id);
    const p = partition(steps, progress, today);
    expect(ids(p.due)).toEqual([b, a]); // earliest first
    expect(ids(p.unseen)).toEqual(steps.slice(6).map((s) => s.id));
    expect(ids(p.weak)).toEqual([d, b]); // times_wrong desc; due + weak counts in both
    expect(ids(p.settled)).toEqual([e, f]); // interval ≥ 7 days with a clean last answer
    expect(ids(p.other)).toEqual([c]);
  });

  // The owner's case: P1 settled, M3 missed twice recently, L3 (7 steps) × 10 questions.
  const l3 = pool('intervals-3');
  const id = (iv: string) => `up-C4-${iv}`;
  const counts = (xs: readonly Step[]) => {
    const m = new Map<string, number>();
    for (const s of xs) m.set(s.id, (m.get(s.id) ?? 0) + 1);
    return m;
  };
  const l3Progress = (m3Due: string) => [
    row(id('P1'), { intervalDays: 14, intervalIndex: 3, dueOn: '2026-10-12' }),
    row(id('M3'), { lastResult: 'wrong', timesWrong: 2, intervalDays: 1, dueOn: m3Due }),
    ...['M2', 'm3', 'P4', 'P5', 'P8'].map((iv) =>
      row(id(iv), { intervalDays: 3, intervalIndex: 1, dueOn: '2026-10-03' }),
    ),
  ];

  it('weights weak steps and shows a settled step at most once (L3, 10 questions)', () => {
    for (const m3Due of ['2026-10-02', today]) {
      for (let seed = 1; seed <= 50; seed++) {
        const chosen = selectQuestions(l3, l3Progress(m3Due), today, 10, createRng(seed));
        expect(chosen).toHaveLength(10);
        const c = counts(chosen);
        expect(c.get(id('P1')) ?? 0).toBeLessThanOrEqual(1);
        expect(c.get(id('M3')) ?? 0).toBeGreaterThanOrEqual(3);
        expect(orderViolations(chosen)).toBe(0);
      }
    }
  });

  it('shares weak slots by times_wrong, at least 2 each when ≤ 3 weak steps', () => {
    const progress = [
      ...l3Progress('2026-10-02'),
      row(id('P4'), { lastResult: 'wrong', timesWrong: 1, intervalDays: 1, dueOn: '2026-10-02' }),
    ];
    const c = counts(chooseQuestions(l3, progress, today, 10));
    expect(c.get(id('M3'))).toBe(4); // ⌈10 × 2/3⌉ = 7, capped at 40 % of 10
    expect(c.get(id('P4'))).toBe(4); // ⌈10 × 1/3⌉ = 4
    expect(c.get(id('P1')) ?? 0).toBe(0); // other fill the last 2 slots before settled
  });

  it('always includes every due and unseen step once', () => {
    const progress = l3Progress('2026-10-02').filter(
      (r) => r.stepId !== id('P4') && r.stepId !== id('M2'),
    );
    progress.push(row(id('P5'), { dueOn: today, intervalDays: 3 }));
    for (let seed = 1; seed <= 20; seed++) {
      const ids = selectQuestions(l3, progress, today, 10, createRng(seed)).map((s) => s.id);
      for (const iv of ['P4', 'M2', 'P5']) expect(ids).toContain(id(iv));
    }
  });

  it('leaves settled steps out when the non-settled steps fill the session', () => {
    const steps = pool('intervals-5'); // 65 steps
    const progress = steps.map((s, i) =>
      i < 20
        ? row(s.id, { intervalDays: 3, dueOn: '2026-10-05' })
        : row(s.id, { intervalDays: 14, intervalIndex: 3, dueOn: '2026-10-20' }),
    );
    const chosen = chooseQuestions(steps, progress, today, 10);
    expect(chosen.every((s) => steps.indexOf(s) < 20)).toBe(true);
  });

  it('repeats settled steps only when the pool has nothing else', () => {
    const steps = pool('intervals-1'); // 3 steps
    const progress = steps.map((s) => row(s.id, { intervalDays: 14, dueOn: '2026-10-20' }));
    expect(chooseQuestions(steps, progress, today, 10)).toHaveLength(10);
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

// engine.md §4 focus rounds ("Drill what you missed").
describe('focus pool', () => {
  const l3 = pool('intervals-3');
  const active = testContent().requireLevel('intervals-3').level.activeOptions;
  const id = (iv: string) => `up-C4-${iv}`;
  const labels = (xs: readonly Step[]) => xs.map((s) => s.label).sort();

  it('misses plus interval neighbours 1–2 semitones away among the active options', () => {
    const progress = [
      row(id('P4'), { lastResult: 'wrong', timesWrong: 1 }),
      row(id('P1'), { lastResult: 'clean' }),
    ];
    // P4 = 5 semitones: m3 (3), M3 (4), P5 (7); TT (6) is not active in L3.
    expect(labels(focusPool(l3, progress, active))).toEqual(['M3', 'P4', 'P5', 'm3']);
  });

  it('hinted counts as a miss; M3 pulls in M2, m3 and P4', () => {
    const progress = [row(id('M3'), { lastResult: 'hinted', timesHinted: 1 })];
    expect(labels(focusPool(l3, progress, active))).toEqual(['M2', 'M3', 'P4', 'm3']);
  });

  it('a miss with nothing within 2 semitones takes the nearest active interval (P8 → P5)', () => {
    const progress = [row(id('P8'), { lastResult: 'wrong', timesWrong: 1 })];
    expect(labels(focusPool(l3, progress, active))).toEqual(['P5', 'P8']);
  });

  it('keeps neighbours on the same root (L5: five roots)', () => {
    const l5 = pool('intervals-5');
    const l5Active = testContent().requireLevel('intervals-5').level.activeOptions;
    const progress = [row('up-D4-P5', { lastResult: 'wrong', timesWrong: 1 })];
    const ids = focusPool(l5, progress, l5Active).map((s) => s.id);
    expect(ids.sort()).toEqual(['up-D4-M6', 'up-D4-P4', 'up-D4-P5', 'up-D4-TT', 'up-D4-m6']);
  });

  it('falls back to the whole pool when nothing was missed', () => {
    expect(focusPool(l3, [row(id('P4'), {})], active)).toHaveLength(l3.length);
  });

  it('non-interval levels drill just the misses', () => {
    const deg = pool('scale-degrees-1');
    const first = deg[0]?.id ?? '';
    const progress = [row(first, { lastResult: 'wrong', timesWrong: 1 })];
    expect(focusPool(deg, progress, undefined).map((s) => s.id)).toEqual([first]);
  });
});
