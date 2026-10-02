import { beforeEach, describe, expect, it } from 'vitest';
import { PROFILE_ID, schema } from '../src';
import { T0, freshDb, levelRow, planBlock, sessionStep, stepRow, type TestDb } from './helpers';

let t: TestDb;
beforeEach(() => {
  t = freshDb();
});

describe('ProfileRepo', () => {
  it('get returns null before create; create makes the single local profile', () => {
    expect(t.repos.profile.get()).toBeNull();
    const p = t.repos.profile.create({ name: 'Harry', timezone: 'America/Los_Angeles', now: T0 });
    expect(p).toEqual({
      id: PROFILE_ID,
      name: 'Harry',
      timezone: 'America/Los_Angeles',
      xpTotal: 0,
      midiDeviceId: null,
      midiDeviceName: null,
      showMarkPlayedAlways: false,
      autoContinue: true,
      createdAt: T0,
      updatedAt: T0,
    });
    expect(t.repos.profile.get()).toEqual(p);
    expect(() => t.repos.profile.create({ name: 'Again', timezone: 'UTC', now: T0 })).toThrow();
  });

  it('update patches fields and bumps updatedAt', () => {
    t.repos.profile.create({ name: 'Harry', timezone: 'UTC', now: T0 });
    const p = t.repos.profile.update(
      {
        midiDeviceId: 'dev-1',
        midiDeviceName: 'Keystation',
        showMarkPlayedAlways: true,
        autoContinue: false,
      },
      T0 + 5,
    );
    expect(p).toMatchObject({
      name: 'Harry',
      midiDeviceId: 'dev-1',
      midiDeviceName: 'Keystation',
      showMarkPlayedAlways: true,
      autoContinue: false,
      createdAt: T0,
      updatedAt: T0 + 5,
    });
    expect(t.repos.profile.update({ midiDeviceId: null }, T0 + 6).midiDeviceId).toBeNull();
  });

  it('update and addXp throw without a profile', () => {
    expect(() => t.repos.profile.update({ name: 'x' }, T0)).toThrow(/Profile does not exist/);
    expect(() => t.repos.profile.addXp(5, T0)).toThrow(/Profile does not exist/);
  });

  it('addXp increments atomically and returns the new total', () => {
    t.repos.profile.create({ name: 'Harry', timezone: 'UTC', now: T0 });
    expect(t.repos.profile.addXp(40, T0 + 1)).toBe(40);
    expect(t.repos.profile.addXp(5, T0 + 2)).toBe(45);
    expect(t.repos.profile.get()).toMatchObject({ xpTotal: 45, updatedAt: T0 + 2 });
  });
});

describe('TrackSettingsRepo', () => {
  const row = {
    trackId: 'ear-training',
    visibility: 'all' as const,
    active: true,
    enrolledAt: T0,
    lastNewLevelAt: null,
    lessonSeenAt: null,
  };

  it('upsert inserts, then replaces every field on conflict', () => {
    expect(t.repos.trackSettings.get('ear-training')).toBeNull();
    expect(t.repos.trackSettings.upsert(row)).toEqual(row);
    const changed = { ...row, visibility: 'num' as const, active: false, lessonSeenAt: T0 + 9 };
    expect(t.repos.trackSettings.upsert(changed)).toEqual(changed);
    expect(t.repos.trackSettings.list()).toEqual([changed]);
  });

  it('list orders by enrolment', () => {
    t.repos.trackSettings.upsert({ ...row, trackId: 'b', enrolledAt: T0 + 1 });
    t.repos.trackSettings.upsert({ ...row, trackId: 'a', enrolledAt: T0 + 2 });
    t.repos.trackSettings.upsert({ ...row, trackId: 'c', enrolledAt: T0 });
    expect(t.repos.trackSettings.list().map((r) => r.trackId)).toEqual(['c', 'b', 'a']);
  });

  it('update patches; missing track → null; empty patch → current row', () => {
    t.repos.trackSettings.upsert(row);
    expect(t.repos.trackSettings.update('ear-training', { lastNewLevelAt: T0 + 3 })).toEqual({
      ...row,
      lastNewLevelAt: T0 + 3,
    });
    expect(t.repos.trackSettings.update('nope', { active: false })).toBeNull();
    expect(t.repos.trackSettings.update('ear-training', {})?.lastNewLevelAt).toBe(T0 + 3);
  });

  it('visibility defaults to all', () => {
    t.db.insert(schema.trackSettings).values({ trackId: 'x', enrolledAt: T0 }).run();
    expect(t.repos.trackSettings.get('x')).toMatchObject({ visibility: 'all', active: true });
  });
});

describe('StepProgressRepo', () => {
  it('upsert inserts with a generated id, then updates on (levelId, stepId) keeping id/createdAt', () => {
    const first = t.repos.stepProgress.upsert(stepRow());
    expect(first.id).toEqual(expect.any(String));
    expect(first.id.length).toBeGreaterThan(10);

    const second = t.repos.stepProgress.upsert(
      stepRow({
        intervalIndex: 0,
        intervalDays: 1,
        dueOn: '2026-03-09',
        lastResult: 'clean',
        timesSeen: 1,
        timesClean: 1,
        createdAt: T0 + 100,
        updatedAt: T0 + 100,
      }),
    );
    expect(second).toMatchObject({
      id: first.id,
      createdAt: T0,
      updatedAt: T0 + 100,
      intervalIndex: 0,
      dueOn: '2026-03-09',
      lastResult: 'clean',
      timesSeen: 1,
      timesClean: 1,
    });
    expect(t.repos.stepProgress.get('c-major', 'd1')).toEqual(second);
    expect(t.repos.stepProgress.get('c-major', 'd2')).toBeNull();
  });

  it('enforces UNIQUE(level_id, step_id) for raw inserts', () => {
    const row = { id: 'a', ...stepRow() };
    t.db.insert(schema.stepProgress).values(row).run();
    expect(() =>
      t.db
        .insert(schema.stepProgress)
        .values({ ...row, id: 'b' })
        .run(),
    ).toThrow(/UNIQUE/);
  });

  it('lists by level and by track', () => {
    t.repos.stepProgress.upsert(stepRow({ stepId: 'd2' }));
    t.repos.stepProgress.upsert(stepRow({ stepId: 'd1' }));
    t.repos.stepProgress.upsert(stepRow({ levelId: 'g-major', stepId: 'd1' }));
    t.repos.stepProgress.upsert(stepRow({ trackId: 'ear-training', levelId: 'i1', stepId: 'P5' }));
    expect(t.repos.stepProgress.listByLevel('c-major').map((r) => r.stepId)).toEqual(['d1', 'd2']);
    expect(
      t.repos.stepProgress
        .listByTrack('major-diatonic-chords')
        .map((r) => `${r.levelId}/${r.stepId}`),
    ).toEqual(['c-major/d1', 'c-major/d2', 'g-major/d1']);
  });

  it('listDue and dueCountByLevel use dueOn ≤ today and skip null', () => {
    const today = '2026-03-08';
    t.repos.stepProgress.upsert(stepRow({ stepId: 'd1', dueOn: '2026-03-08' }));
    t.repos.stepProgress.upsert(stepRow({ stepId: 'd2', dueOn: '2026-03-01' }));
    t.repos.stepProgress.upsert(stepRow({ stepId: 'd3', dueOn: '2026-03-09' }));
    t.repos.stepProgress.upsert(stepRow({ stepId: 'd4', dueOn: null }));
    t.repos.stepProgress.upsert(stepRow({ levelId: 'g-major', stepId: 'd7', dueOn: '2026-03-05' }));

    expect(t.repos.stepProgress.listDue(today).map((r) => `${r.levelId}/${r.stepId}`)).toEqual([
      'c-major/d2',
      'g-major/d7',
      'c-major/d1',
    ]);
    expect(t.repos.stepProgress.dueCountByLevel(today)).toEqual([
      {
        levelId: 'c-major',
        trackId: 'major-diatonic-chords',
        count: 2,
        earliestDueOn: '2026-03-01',
      },
      {
        levelId: 'g-major',
        trackId: 'major-diatonic-chords',
        count: 1,
        earliestDueOn: '2026-03-05',
      },
    ]);
    expect(t.repos.stepProgress.listDue('2026-02-28')).toEqual([]);
    expect(t.repos.stepProgress.dueCountByLevel('2026-02-28')).toEqual([]);
  });
});

describe('LevelProgressRepo', () => {
  it('upsert inserts then replaces on levelId; get returns null when missing', () => {
    expect(t.repos.levelProgress.get('c-major')).toBeNull();
    expect(t.repos.levelProgress.upsert(levelRow())).toEqual(levelRow());
    const done = levelRow({
      status: 'completed',
      attempts: 1,
      firstCompletedAt: T0,
      lastCompletedAt: T0,
      lastScore: 71,
      bestScore: 71,
      bestTimeMs: 95_000,
      updatedAt: T0 + 1,
    });
    expect(t.repos.levelProgress.upsert(done)).toEqual(done);
    expect(t.repos.levelProgress.get('c-major')).toEqual(done);
  });

  it('lists by track, all, and mastered', () => {
    t.repos.levelProgress.upsert(levelRow({ levelId: 'g-major', mastered: true, masteredAt: T0 }));
    t.repos.levelProgress.upsert(levelRow({ levelId: 'c-major' }));
    t.repos.levelProgress.upsert(
      levelRow({ levelId: 'intervals-1', trackId: 'ear-training', mastered: true }),
    );
    expect(
      t.repos.levelProgress.listByTrack('major-diatonic-chords').map((r) => r.levelId),
    ).toEqual(['c-major', 'g-major']);
    expect(t.repos.levelProgress.listAll().map((r) => r.levelId)).toEqual([
      'c-major',
      'g-major',
      'intervals-1',
    ]);
    expect(t.repos.levelProgress.listMastered().map((r) => r.levelId)).toEqual([
      'g-major',
      'intervals-1',
    ]);
  });
});

describe('SessionRepo', () => {
  const base = {
    trackId: 'major-diatonic-chords',
    levelId: 'c-major',
    kind: 'learn' as const,
    startedAt: T0,
  };

  it('create fills defaults and generates an id; get / missing get', () => {
    const s = t.repos.sessions.create(base);
    expect(s).toEqual({
      id: expect.any(String) as string,
      ...base,
      planBlockId: null,
      finishedAt: null,
      durationMs: null,
      stepsTotal: 0,
      stepsClean: 0,
      stepsHinted: 0,
      stepsSkipped: 0,
      stepsMarked: 0,
      stepsWrong: 0,
      correct: null,
      passed: null,
      xpSteps: 0,
      xpLevel: 0,
      xpPlayback: 0,
      questionOrder: null,
      focus: null,
    });
    expect(t.repos.sessions.get(s.id)).toEqual(s);
    expect(t.repos.sessions.get('missing')).toBeNull();
  });

  it('create accepts an explicit id, plan block and question order (JSON round-trip)', () => {
    const s = t.repos.sessions.create({
      ...base,
      id: 'sess-1',
      kind: 'review',
      planBlockId: 'blk-1',
      questionOrder: ['P5', 'M3', 'P5'],
      focus: 'misses',
    });
    expect(t.repos.sessions.get('sess-1')).toMatchObject({
      id: 'sess-1',
      planBlockId: 'blk-1',
      questionOrder: ['P5', 'M3', 'P5'],
      focus: 'misses',
    });
    expect(s.kind).toBe('review');
  });

  it('update finishes a session; empty patch returns current; missing → null', () => {
    const s = t.repos.sessions.create(base);
    const done = t.repos.sessions.update(s.id, {
      finishedAt: T0 + 60_000,
      durationMs: 60_000,
      stepsTotal: 7,
      stepsClean: 5,
      stepsHinted: 2,
      correct: 7,
      passed: true,
      xpSteps: 35,
      xpLevel: 40,
    });
    expect(done).toMatchObject({ finishedAt: T0 + 60_000, passed: true, xpLevel: 40 });
    expect(t.repos.sessions.update(s.id, {})).toEqual(done);
    expect(t.repos.sessions.update('missing', { durationMs: 1 })).toBeNull();
  });

  it('listByLevel and listStartedBetween order by startedAt', () => {
    const a = t.repos.sessions.create({ ...base, startedAt: T0 + 20 });
    const b = t.repos.sessions.create({ ...base, startedAt: T0 });
    const c = t.repos.sessions.create({ ...base, levelId: 'g-major', startedAt: T0 + 10 });
    expect(t.repos.sessions.listByLevel('c-major').map((s) => s.id)).toEqual([b.id, a.id]);
    expect(t.repos.sessions.listStartedBetween(T0, T0 + 20).map((s) => s.id)).toEqual([b.id, c.id]);
  });

  it('upsertStep is idempotent on (sessionId, ordinal) and keeps id/createdAt', () => {
    const s = t.repos.sessions.create(base);
    const first = t.repos.sessions.upsertStep(
      sessionStep(s.id, { result: 'hinted', hintLevel: 1 }),
    );
    expect(first).toMatchObject({ result: 'hinted', hintLevel: 1, playedBack: false });
    const retry = t.repos.sessions.upsertStep(
      sessionStep(s.id, {
        result: 'clean',
        tries: 2,
        chosen: 'P5',
        elapsedMs: 900,
        createdAt: T0 + 50,
      }),
    );
    expect(retry).toEqual({
      ...first,
      result: 'clean',
      hintLevel: 0,
      tries: 2,
      chosen: 'P5',
      elapsedMs: 900,
    });
    expect(t.repos.sessions.listSteps(s.id)).toHaveLength(1);
  });

  it('upsertStep only writes playedBack when provided', () => {
    const s = t.repos.sessions.create(base);
    t.repos.sessions.upsertStep(sessionStep(s.id, { playedBack: true }));
    expect(t.repos.sessions.upsertStep(sessionStep(s.id)).playedBack).toBe(true);
    expect(t.repos.sessions.upsertStep(sessionStep(s.id, { playedBack: false })).playedBack).toBe(
      false,
    );
  });

  it('listSteps orders by ordinal and is scoped to the session', () => {
    const s = t.repos.sessions.create(base);
    const other = t.repos.sessions.create(base);
    t.repos.sessions.upsertStep(sessionStep(s.id, { ordinal: 2, stepId: 'd3' }));
    t.repos.sessions.upsertStep(sessionStep(s.id, { ordinal: 0, stepId: 'd1' }));
    t.repos.sessions.upsertStep(sessionStep(s.id, { ordinal: 1, stepId: 'd2' }));
    t.repos.sessions.upsertStep(sessionStep(other.id, { ordinal: 0 }));
    expect(t.repos.sessions.listSteps(s.id).map((r) => r.stepId)).toEqual(['d1', 'd2', 'd3']);
  });

  it('markPlayedBack flips once', () => {
    const s = t.repos.sessions.create(base);
    t.repos.sessions.upsertStep(sessionStep(s.id, { ordinal: 3 }));
    expect(t.repos.sessions.markPlayedBack(s.id, 3)).toBe(true);
    expect(t.repos.sessions.markPlayedBack(s.id, 3)).toBe(false);
    expect(t.repos.sessions.markPlayedBack(s.id, 4)).toBe(false);
    expect(t.repos.sessions.listSteps(s.id)[0]?.playedBack).toBe(true);
  });

  it('session_steps require an existing session (foreign_keys=ON)', () => {
    expect(() => t.repos.sessions.upsertStep(sessionStep('nope'))).toThrow(/FOREIGN KEY/);
  });
});

describe('XpRepo', () => {
  const entry = {
    amount: 5,
    reason: 'step' as const,
    sessionId: null,
    stepId: 'd1',
    day: '2026-03-08',
    createdAt: T0,
  };

  it('award writes the ledger and increments profile.xp_total together', () => {
    t.repos.profile.create({ name: 'Harry', timezone: 'UTC', now: T0 });
    const s = t.repos.sessions.create({
      trackId: 'major-diatonic-chords',
      levelId: 'c-major',
      kind: 'learn',
      startedAt: T0,
    });
    const r1 = t.repos.xp.award({ ...entry, sessionId: s.id });
    expect(r1.newTotal).toBe(5);
    expect(r1.entry).toMatchObject({ amount: 5, reason: 'step', sessionId: s.id });
    const r2 = t.repos.xp.award({
      ...entry,
      id: 'xp-2',
      amount: 40,
      reason: 'level',
      stepId: null,
      sessionId: s.id,
      createdAt: T0 + 1,
    });
    expect(r2).toMatchObject({ newTotal: 45, entry: { id: 'xp-2' } });
    expect(t.repos.profile.get()?.xpTotal).toBe(45);
    expect(t.repos.xp.listBySession(s.id).map((e) => e.amount)).toEqual([5, 40]);
  });

  it('award rolls back the ledger row if the profile increment fails', () => {
    expect(() => t.repos.xp.award(entry)).toThrow(/Profile does not exist/);
    expect(t.repos.xp.listByDay('2026-03-08')).toEqual([]);
  });

  it('listByDay and sumByDay', () => {
    t.repos.profile.create({ name: 'Harry', timezone: 'UTC', now: T0 });
    t.repos.xp.award(entry);
    t.repos.xp.award({ ...entry, amount: 40, reason: 'level', createdAt: T0 + 1 });
    t.repos.xp.award({ ...entry, day: '2026-03-09', createdAt: T0 + 2 });
    expect(t.repos.xp.listByDay('2026-03-08').map((e) => e.amount)).toEqual([5, 40]);
    expect(t.repos.xp.sumByDay('2026-03-08')).toBe(45);
    expect(t.repos.xp.sumByDay('2026-03-10')).toBe(0);
  });
});

describe('DayLogRepo', () => {
  it('increment creates the day then adds counters, keeping firstCompletedAt', () => {
    expect(t.repos.dayLog.get('2026-03-08')).toBeNull();
    expect(
      t.repos.dayLog.increment({ day: '2026-03-08', blocks: 1, sessions: 1, xp: 75, at: T0 }),
    ).toEqual({
      day: '2026-03-08',
      blocksCompleted: 1,
      sessionsCompleted: 1,
      xp: 75,
      firstCompletedAt: T0,
    });
    expect(
      t.repos.dayLog.increment({ day: '2026-03-08', blocks: 0, sessions: 1, xp: 40, at: T0 + 9 }),
    ).toEqual({
      day: '2026-03-08',
      blocksCompleted: 1,
      sessionsCompleted: 2,
      xp: 115,
      firstCompletedAt: T0,
    });
  });

  it('upsert replaces the row; listRange is inclusive and ascending', () => {
    for (const day of ['2026-03-09', '2026-03-05', '2026-03-07', '2026-03-10']) {
      t.repos.dayLog.upsert({
        day,
        blocksCompleted: 1,
        sessionsCompleted: 1,
        xp: 10,
        firstCompletedAt: T0,
      });
    }
    const replaced = {
      day: '2026-03-07',
      blocksCompleted: 3,
      sessionsCompleted: 4,
      xp: 200,
      firstCompletedAt: T0 + 1,
    };
    expect(t.repos.dayLog.upsert(replaced)).toEqual(replaced);
    expect(t.repos.dayLog.listRange('2026-03-05', '2026-03-09').map((r) => r.day)).toEqual([
      '2026-03-05',
      '2026-03-07',
      '2026-03-09',
    ]);
    expect(t.repos.dayLog.get('2026-03-07')).toEqual(replaced);
  });
});

describe('PlanRepo', () => {
  const plan = { day: '2026-03-08', generatedAt: T0, learnTrackId: 'major-diatonic-chords' };

  it('save persists the plan and blocks; get orders blocks by slot', () => {
    expect(t.repos.plans.get('2026-03-08')).toBeNull();
    const saved = t.repos.plans.save(plan, [
      planBlock({ slot: 2, type: 'review', levelId: 'g-major', title: 'G major' }),
      planBlock({ slot: 0 }),
      planBlock({
        slot: 1,
        type: 'learn',
        levelId: 'a-major',
        title: 'A major',
        estimateMin: 5,
        lessonFirst: true,
      }),
    ]);
    expect(saved.plan).toEqual(plan);
    expect(saved.blocks.map((b) => [b.slot, b.type])).toEqual([
      [0, 'warmup'],
      [1, 'learn'],
      [2, 'review'],
    ]);
    expect(saved.blocks[1]).toMatchObject({ lessonFirst: true, status: 'pending' });
    expect(t.repos.plans.get('2026-03-08')).toEqual(saved);
  });

  it('save is an upsert on (day, slot): existing block ids are kept', () => {
    const first = t.repos.plans.save(plan, [planBlock({ slot: 0 })]);
    const again = t.repos.plans.save({ ...plan, generatedAt: T0 + 1, learnTrackId: null }, [
      planBlock({ slot: 0, title: 'C major (again)' }),
    ]);
    expect(again.plan).toMatchObject({ generatedAt: T0 + 1, learnTrackId: null });
    expect(again.blocks).toHaveLength(1);
    expect(again.blocks[0]).toMatchObject({ id: first.blocks[0]?.id, title: 'C major (again)' });
  });

  it('save rolls back entirely when a block belongs to another day', () => {
    expect(() =>
      t.repos.plans.save(plan, [planBlock({ slot: 0 }), planBlock({ slot: 1, day: '2026-03-09' })]),
    ).toThrow(/Plan block for 2026-03-09/);
    expect(t.repos.plans.get('2026-03-08')).toBeNull();
  });

  it('getBlock / updateBlock track status', () => {
    const saved = t.repos.plans.save(plan, [planBlock({ id: 'blk-0', slot: 0 })]);
    expect(saved.blocks[0]?.id).toBe('blk-0');
    expect(t.repos.plans.getBlock('blk-0')?.status).toBe('pending');
    expect(t.repos.plans.getBlock('missing')).toBeNull();
    expect(
      t.repos.plans.updateBlock('blk-0', { status: 'in_progress', sessionId: 'sess-1' }),
    ).toMatchObject({ status: 'in_progress', sessionId: 'sess-1', completedAt: null });
    expect(
      t.repos.plans.updateBlock('blk-0', { status: 'done', completedAt: T0 + 5 }),
    ).toMatchObject({ status: 'done', completedAt: T0 + 5 });
    expect(t.repos.plans.updateBlock('blk-0', {})?.status).toBe('done');
    expect(t.repos.plans.updateBlock('missing', { status: 'done' })).toBeNull();
  });

  it('enforces UNIQUE(day, slot) for raw inserts', () => {
    t.repos.plans.save(plan, [planBlock({ id: 'a', slot: 0 })]);
    expect(() =>
      t.db
        .insert(schema.planBlocks)
        .values({ ...planBlock({ slot: 0 }), id: 'b' })
        .run(),
    ).toThrow(/UNIQUE/);
  });
});

describe('Repos.transaction', () => {
  it('commits and returns the callback result', () => {
    const out = t.repos.transaction(() => {
      t.repos.profile.create({ name: 'Harry', timezone: 'UTC', now: T0 });
      return t.repos.profile.addXp(10, T0);
    });
    expect(out).toBe(10);
    expect(t.repos.profile.get()?.xpTotal).toBe(10);
  });

  it('rolls back everything when the callback throws', () => {
    expect(() =>
      t.repos.transaction(() => {
        t.repos.profile.create({ name: 'Harry', timezone: 'UTC', now: T0 });
        t.repos.dayLog.increment({ day: '2026-03-08', blocks: 1, sessions: 1, xp: 5, at: T0 });
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(t.repos.profile.get()).toBeNull();
    expect(t.repos.dayLog.get('2026-03-08')).toBeNull();
  });

  it('nests: an inner failure caught by the caller rolls back only the inner work', () => {
    t.repos.transaction(() => {
      t.repos.profile.create({ name: 'Harry', timezone: 'UTC', now: T0 });
      t.repos.xp.award({
        amount: 5,
        reason: 'step',
        sessionId: null,
        stepId: null,
        day: '2026-03-08',
        createdAt: T0,
      });
      try {
        t.repos.transaction(() => {
          t.repos.profile.addXp(100, T0);
          throw new Error('inner');
        });
      } catch {
        // swallowed on purpose
      }
    });
    expect(t.repos.profile.get()?.xpTotal).toBe(5);
    expect(t.repos.xp.sumByDay('2026-03-08')).toBe(5);
  });
});
