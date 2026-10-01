import { describe, expect, it } from 'vitest';
import type { StepProgressUpsert } from '../ports';
import { createMemoryRepos } from './memoryRepos';

const sp = (patch: Partial<StepProgressUpsert>): StepProgressUpsert => ({
  trackId: 't',
  levelId: 'l1',
  stepId: 's1',
  intervalIndex: -1,
  intervalDays: 0,
  dueOn: null,
  lastResult: null,
  lastSeenAt: 1,
  timesSeen: 0,
  timesClean: 0,
  timesHinted: 0,
  timesWrong: 0,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

// The in-memory repos must behave like packages/db/src/repos (ports.ts contracts).
describe('createMemoryRepos', () => {
  it('xp.award writes the ledger and bumps profile.xp_total atomically', () => {
    const r = createMemoryRepos();
    expect(() =>
      r.xp.award({
        amount: 5,
        reason: 'step',
        sessionId: null,
        stepId: null,
        day: 'd',
        createdAt: 1,
      }),
    ).toThrow(/Profile/);
    expect(r.xp.listByDay('d')).toEqual([]); // rolled back
    r.profile.create({ name: 'H', timezone: 'UTC', now: 0 });
    const { newTotal } = r.xp.award({
      amount: 5,
      reason: 'step',
      sessionId: 's',
      stepId: null,
      day: 'd',
      createdAt: 1,
    });
    r.xp.award({
      amount: 40,
      reason: 'level',
      sessionId: 's',
      stepId: null,
      day: 'd',
      createdAt: 2,
    });
    expect(newTotal).toBe(5);
    expect(r.profile.get()?.xpTotal).toBe(45);
    expect(r.xp.sumByDay('d')).toBe(45);
    expect(r.xp.listBySession('s').map((e) => e.amount)).toEqual([5, 40]);
  });

  it('stepProgress.upsert replaces non-key fields and keeps id/createdAt', () => {
    const r = createMemoryRepos();
    const a = r.stepProgress.upsert(sp({ timesSeen: 1 }));
    const b = r.stepProgress.upsert(sp({ timesSeen: 2, createdAt: 99, dueOn: '2026-01-02' }));
    expect(b.id).toBe(a.id);
    expect(b.createdAt).toBe(1);
    expect(b.timesSeen).toBe(2);
    r.stepProgress.upsert(sp({ stepId: 's0', dueOn: '2026-01-01' }));
    r.stepProgress.upsert(sp({ levelId: 'l2', stepId: 's9', dueOn: '2026-01-03' }));
    expect(r.stepProgress.listDue('2026-01-02').map((x) => x.stepId)).toEqual(['s0', 's1']);
    expect(r.stepProgress.dueCountByLevel('2026-01-05')).toEqual([
      { levelId: 'l1', trackId: 't', count: 2, earliestDueOn: '2026-01-01' },
      { levelId: 'l2', trackId: 't', count: 1, earliestDueOn: '2026-01-03' },
    ]);
  });

  it('sessions.upsertStep is idempotent on (sessionId, ordinal); markPlayedBack reports changes', () => {
    const r = createMemoryRepos();
    const s = r.sessions.create({ trackId: 't', levelId: 'l', kind: 'learn', startedAt: 5 });
    expect(s).toMatchObject({
      planBlockId: null,
      finishedAt: null,
      xpSteps: 0,
      questionOrder: null,
    });
    const base = {
      sessionId: s.id,
      levelId: 'l',
      stepId: 'a',
      ordinal: 0,
      result: 'clean',
      hintLevel: 0,
      tries: null,
      chosen: null,
      elapsedMs: null,
      createdAt: 10,
    } as const;
    const first = r.sessions.upsertStep(base);
    expect(r.sessions.markPlayedBack(s.id, 0)).toBe(true);
    expect(r.sessions.markPlayedBack(s.id, 0)).toBe(false);
    expect(r.sessions.markPlayedBack(s.id, 5)).toBe(false);
    const again = r.sessions.upsertStep({ ...base, result: 'hinted', createdAt: 20 });
    expect(again).toMatchObject({
      id: first.id,
      createdAt: 10,
      result: 'hinted',
      playedBack: true,
    });
    expect(r.sessions.listSteps(s.id)).toHaveLength(1);
  });

  it('dayLog.increment adds counters and keeps firstCompletedAt', () => {
    const r = createMemoryRepos();
    r.dayLog.increment({ day: 'd', blocks: 1, sessions: 1, xp: 10, at: 100 });
    const row = r.dayLog.increment({ day: 'd', blocks: 0, sessions: 1, xp: 5, at: 200 });
    expect(row).toEqual({
      day: 'd',
      blocksCompleted: 1,
      sessionsCompleted: 2,
      xp: 15,
      firstCompletedAt: 100,
    });
  });

  it('plans.save upserts blocks on (day, slot) keeping ids; rejects foreign days', () => {
    const r = createMemoryRepos();
    const block = {
      day: 'd',
      slot: 0,
      type: 'learn',
      trackId: 't',
      levelId: 'l',
      title: 'T',
      blurb: 'B',
      estimateMin: 5,
      status: 'pending',
      sessionId: null,
      completedAt: null,
      lessonFirst: false,
    } as const;
    const a = r.plans.save({ day: 'd', generatedAt: 1, learnTrackId: 't' }, [block]);
    const b = r.plans.save({ day: 'd', generatedAt: 2, learnTrackId: 't' }, [
      { ...block, title: 'U' },
    ]);
    expect(b.blocks[0]?.id).toBe(a.blocks[0]?.id);
    expect(b.blocks[0]?.title).toBe('U');
    expect(() => r.plans.save({ day: 'e', generatedAt: 1, learnTrackId: null }, [block])).toThrow();
    expect(r.plans.get('e')).toBeNull(); // rolled back
    expect(r.plans.updateBlock(a.blocks[0]?.id ?? '', {})?.title).toBe('U');
  });

  it('returns copies (callers cannot mutate stored rows)', () => {
    const r = createMemoryRepos();
    r.profile.create({ name: 'H', timezone: 'UTC', now: 0 });
    const p = r.profile.get();
    if (p) p.name = 'X';
    expect(r.profile.get()?.name).toBe('H');
    expect(() => r.profile.create({ name: 'H', timezone: 'UTC', now: 0 })).toThrow();
  });

  it('transaction restores state when fn throws (nests like a savepoint)', () => {
    const r = createMemoryRepos();
    r.profile.create({ name: 'H', timezone: 'UTC', now: 0 });
    r.transaction(() => {
      r.profile.addXp(5, 1);
      expect(() =>
        r.transaction(() => {
          r.profile.addXp(100, 2);
          throw new Error('boom');
        }),
      ).toThrow('boom');
    });
    expect(r.profile.get()?.xpTotal).toBe(5);
  });
});
