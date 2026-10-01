import { describe, expect, it } from 'vitest';
import { playLevel, seed } from './seed';
import { EVENING, TZ, createHarness, onboarded } from './testing/harness';

// engine.md §4 ProgressService.
describe('sessions.start', () => {
  it('chord level: steps with last results, no questions; sets level in_progress', () => {
    const { services } = onboarded();
    const s = services.progress.startLevel('c-major', 'learn');
    expect(s).toMatchObject({
      levelId: 'c-major',
      levelTitle: 'C major',
      shortTitle: 'C major',
      trackTitle: 'Major diatonic chords',
      isEar: false,
      resumed: false,
      visibility: 'all',
      pass: null,
      questions: [],
      results: [],
    });
    expect(s.steps.map((x) => x.label)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(s.steps[0]).toMatchObject({ lastResult: null, dueOn: null, intervalDays: 0 });
    expect(services.repos.levelProgress.get('c-major')?.status).toBe('in_progress');
  });

  it('ear level: questions[] carry the full selected steps with ordinals', () => {
    const { services } = onboarded();
    const s = services.progress.startLevel('intervals-3', 'learn');
    expect(s.isEar).toBe(true);
    expect(s.pass).toEqual({ correct: 8, of: 10 });
    expect(s.steps).toEqual([]);
    expect(s.questions).toHaveLength(10);
    const pool = services.content.requireLevel('intervals-3').level.pool ?? [];
    s.questions.forEach((q, i) => {
      expect(q.ordinal).toBe(i);
      const step = pool.find((p) => p.id === q.id);
      expect(step).toBeDefined();
      expect(q).toEqual({ ...step, ordinal: i });
      expect(q.play?.type).toBe('notes');
      expect(q.explain).toBeTruthy();
    });
    expect(services.repos.sessions.get(s.sessionId)?.questionOrder).toEqual(
      s.questions.map((q) => q.id),
    );
  });

  it('resumes an unfinished session for the same level today', () => {
    const { services, clock } = onboarded();
    const a = services.progress.startLevel('c-major', 'learn');
    services.progress.recordStep({
      sessionId: a.sessionId,
      stepId: 'd1',
      ordinal: 0,
      result: 'clean',
      hintLevel: 0,
    });
    clock.advanceMinutes(10);
    const b = services.progress.startLevel('c-major', 'learn');
    expect(b.sessionId).toBe(a.sessionId);
    expect(b.resumed).toBe(true);
    expect(b.results).toEqual([
      expect.objectContaining({ ordinal: 0, stepId: 'd1', result: 'clean', playedBack: false }),
    ]);
    expect(services.progress.getSession(a.sessionId).results).toHaveLength(1);
    // a new day starts a new session
    clock.advanceDays(1);
    expect(services.progress.startLevel('c-major', 'learn').sessionId).not.toBe(a.sessionId);
  });

  it('ear resume keeps the same question order', () => {
    const { services, clock } = onboarded();
    const a = services.progress.startLevel('intervals-1', 'learn');
    clock.advanceMinutes(1);
    const b = services.progress.startLevel('intervals-1', 'learn');
    expect(b.questions).toEqual(a.questions);
  });

  it('learn on the next new level stamps last_new_level_at; review does not', () => {
    const { services, clock } = onboarded();
    services.progress.startLevel('g-major', 'learn'); // not the next new level (C is)
    expect(services.repos.trackSettings.get('major-diatonic-chords')?.lastNewLevelAt).toBeNull();
    services.progress.startLevel('c-major', 'review');
    expect(services.repos.trackSettings.get('major-diatonic-chords')?.lastNewLevelAt).toBeNull();
    clock.advanceDays(1);
    services.progress.startLevel('c-major', 'learn');
    expect(services.repos.trackSettings.get('major-diatonic-chords')?.lastNewLevelAt).toBe(
      clock.now(),
    );
  });

  it('claims a plan block (in_progress) and rejects a mismatched block id', () => {
    const { services } = onboarded();
    const block = services.plan.getToday().blocks[0];
    expect(() => services.progress.startLevel('g-major', 'learn', block?.id)).toThrow(
      /is for c-major/,
    );
    const s = services.progress.startLevel('c-major', 'learn', block?.id);
    expect(s.planBlockId).toBe(block?.id);
    expect(services.repos.plans.getBlock(block?.id ?? '')).toMatchObject({
      status: 'in_progress',
      sessionId: s.sessionId,
    });
  });

  it('requires a profile', () => {
    const { services } = createHarness();
    expect(() => services.progress.startLevel('c-major', 'learn')).toThrow(/profile/);
  });
});

describe('sessions.recordStep / recordPlayback', () => {
  it('returns XP, total and the new schedule', () => {
    const { services, clock } = onboarded();
    const s = services.progress.startLevel('c-major', 'learn');
    const r = services.progress.recordStep({
      sessionId: s.sessionId,
      stepId: 'd7',
      ordinal: 6,
      result: 'hinted',
      hintLevel: 2,
      elapsedMs: 8000,
    });
    clock.advanceDays(1);
    expect(r).toEqual({ xpAwarded: 5, xpTotal: 5, dueOn: clock.today(TZ), intervalDays: 1 });
    const row = services.repos.sessions.listSteps(s.sessionId)[0];
    expect(row).toMatchObject({ stepId: 'd7', ordinal: 6, hintLevel: 2, elapsedMs: 8000 });
  });

  it('validates the step and the ear question ordinal', () => {
    const { services } = onboarded();
    const s = services.progress.startLevel('intervals-1', 'learn');
    const q = s.questions[0];
    expect(() =>
      services.progress.recordStep({
        sessionId: s.sessionId,
        stepId: 'nope',
        ordinal: 0,
        result: 'clean',
        hintLevel: 0,
      }),
    ).toThrow(/Unknown step/);
    const other = s.questions.find((x) => x.id !== q?.id);
    expect(() =>
      services.progress.recordStep({
        sessionId: s.sessionId,
        stepId: other?.id ?? '',
        ordinal: 0,
        result: 'clean',
        hintLevel: 0,
      }),
    ).toThrow(/Question 0/);
    expect(() =>
      services.progress.recordStep({
        sessionId: 'missing',
        stepId: 'd1',
        ordinal: 0,
        result: 'clean',
        hintLevel: 0,
      }),
    ).toThrow(/Unknown session/);
  });

  it('a step repeated within one ear session advances its interval once', () => {
    const { services } = onboarded();
    const s = services.progress.startLevel('intervals-1', 'learn'); // 3-step pool, 10 questions
    for (const q of s.questions) {
      services.progress.recordStep({
        sessionId: s.sessionId,
        stepId: q.id,
        ordinal: q.ordinal,
        result: 'clean',
        hintLevel: 0,
      });
    }
    for (const row of services.repos.stepProgress.listByLevel('intervals-1')) {
      expect(row.intervalDays).toBe(1);
      expect(row.timesClean).toBeGreaterThanOrEqual(3);
    }
  });

  it('playback is ear-only and idempotent', () => {
    const { services } = onboarded();
    const chord = services.progress.startLevel('c-major', 'learn');
    services.progress.recordStep({
      sessionId: chord.sessionId,
      stepId: 'd1',
      ordinal: 0,
      result: 'clean',
      hintLevel: 0,
    });
    expect(
      services.progress.recordPlayback({ sessionId: chord.sessionId, ordinal: 0 }).xpAwarded,
    ).toBe(0);
    const ear = services.progress.startLevel('intervals-1', 'learn');
    // nothing recorded at that ordinal yet → no play-back to mark
    expect(
      services.progress.recordPlayback({ sessionId: ear.sessionId, ordinal: 0 }).xpAwarded,
    ).toBe(0);
  });
});

describe('sessions.finish', () => {
  it('a chord level with a skipped step still completes; skipped is listed in the review note', () => {
    const { services } = onboarded();
    const s = services.progress.startLevel('c-major', 'learn');
    s.steps.forEach((step, ordinal) =>
      services.progress.recordStep({
        sessionId: s.sessionId,
        stepId: step.id,
        ordinal,
        result: step.id === 'd2' || step.id === 'd7' ? 'skipped' : 'clean',
        hintLevel: 0,
      }),
    );
    const done = services.progress.finishSession({ sessionId: s.sessionId, durationMs: 90_000 });
    expect(done).toMatchObject({
      completed: true,
      firstCompletion: true,
      cleanCount: 5,
      skippedCount: 2,
      total: 7,
      reviewNote: 'Dm and B° come back tomorrow.',
      subtitle: "All seven diatonic chords. That's your first key on the circle.",
      levelStatus: 'completed',
    });
    expect(services.repos.levelProgress.get('c-major')).toMatchObject({
      status: 'completed',
      attempts: 1,
      lastScore: 71,
      bestScore: 71,
      bestTimeMs: 90_000,
    });
  });

  it('an incomplete chord level is not completed and earns no level XP', () => {
    const { services } = onboarded();
    const s = services.progress.startLevel('c-major', 'learn');
    services.progress.recordStep({
      sessionId: s.sessionId,
      stepId: 'd1',
      ordinal: 0,
      result: 'clean',
      hintLevel: 0,
    });
    const done = services.progress.finishSession({ sessionId: s.sessionId, durationMs: 1 });
    expect(done).toMatchObject({ completed: false, title: 'C major, not finished', next: null });
    expect(done.xp.level).toBe(0);
    expect(services.repos.levelProgress.get('c-major')?.status).toBe('in_progress');
  });

  it('abandoned: no completion, no streak, block back to pending', () => {
    const { services } = onboarded();
    const block = services.plan.getToday().blocks[0];
    const s = services.progress.startLevel('c-major', 'learn', block?.id);
    s.steps.forEach((step, ordinal) =>
      services.progress.recordStep({
        sessionId: s.sessionId,
        stepId: step.id,
        ordinal,
        result: 'clean',
        hintLevel: 0,
      }),
    );
    const done = services.progress.finishSession({
      sessionId: s.sessionId,
      durationMs: 1,
      abandoned: true,
    });
    expect(done.completed).toBe(false);
    expect(services.repos.plans.getBlock(block?.id ?? '')?.status).toBe('pending');
    expect(services.streak.current().keptToday).toBe(false);
  });

  it('is idempotent: finishing twice returns the same result without new XP', () => {
    const { services } = onboarded();
    const s = services.progress.startLevel('c-major', 'learn');
    s.steps.forEach((step, ordinal) =>
      services.progress.recordStep({
        sessionId: s.sessionId,
        stepId: step.id,
        ordinal,
        result: 'clean',
        hintLevel: 0,
      }),
    );
    const a = services.progress.finishSession({ sessionId: s.sessionId, durationMs: 5 });
    const b = services.progress.finishSession({ sessionId: s.sessionId, durationMs: 9 });
    expect(b).toEqual(a);
    expect(services.xp.total()).toBe(75);
    expect(services.repos.dayLog.get(services.clock.today(TZ))?.sessionsCompleted).toBe(1);
    expect(() =>
      services.progress.recordStep({
        sessionId: s.sessionId,
        stepId: 'd1',
        ordinal: 0,
        result: 'clean',
        hintLevel: 0,
      }),
    ).toThrow(/finished/);
  });

  it('updates mastery on level_progress', () => {
    const { services, clock } = onboarded();
    for (const advance of [0, 1, 3]) {
      clock.advanceDays(advance);
      playLevel(services, { levelId: 'c-major', kind: 'free' });
    }
    expect(services.repos.levelProgress.get('c-major')).toMatchObject({ mastered: true });
    clock.advanceDays(1);
    playLevel(services, { levelId: 'c-major', kind: 'free', hinted: ['d1'] });
    expect(services.repos.levelProgress.get('c-major')).toMatchObject({
      mastered: false,
      masteredAt: null,
    });
  });

  it('ear pass → "Keep going — Level 2"', () => {
    const { services } = onboarded();
    const s = services.progress.startLevel('intervals-1', 'learn');
    s.questions.forEach((q) =>
      services.progress.recordStep({
        sessionId: s.sessionId,
        stepId: q.id,
        ordinal: q.ordinal,
        result: 'clean',
        hintLevel: 0,
      }),
    );
    const done = services.progress.finishSession({ sessionId: s.sessionId, durationMs: 1 });
    expect(done).toMatchObject({
      title: 'Intervals · Level 1, passed',
      correct: 10,
      total: 10,
      track: { done: 1, total: 20, unit: 'levels', nextTitle: 'Level 2' },
      next: { levelId: 'intervals-2', label: 'Keep going — Level 2', route: '/ear/intervals-2' },
    });
    expect(done.chips).toHaveLength(10);
  });
});

describe('nextLevel and overview', () => {
  it('circle → next uncompleted level clockwise, wrapping; null when all done', () => {
    const { services } = onboarded();
    const keys = services.content.levelOrder('major-diatonic-chords').map((l) => l.id);
    expect(services.progress.nextLevel('major-diatonic-chords', 'c-major')?.id).toBe('g-major');
    playLevel(services, { levelId: 'g-major', kind: 'free' });
    expect(services.progress.nextLevel('major-diatonic-chords', 'c-major')?.id).toBe('d-major');
    expect(services.progress.nextLevel('major-diatonic-chords', 'f-major')?.id).toBe('c-major');
    for (const id of keys) playLevel(services, { levelId: id, kind: 'free' });
    expect(services.progress.nextLevel('major-diatonic-chords', 'c-major')).toBeNull();
    expect(services.progress.currentLevel('major-diatonic-chords')).toBeNull();
  });

  it('circle overview: node states, completed titles, up next', () => {
    const { services } = onboarded();
    for (const id of ['c-major', 'g-major', 'd-major'])
      playLevel(services, { levelId: id, kind: 'free' });
    const o = services.progress.trackOverview('major-diatonic-chords');
    expect(o.nodes?.slice(0, 5).map((n) => [n.label, n.state])).toEqual([
      ['C', 'done'],
      ['G', 'done'],
      ['D', 'done'],
      ['A', 'current'],
      ['E', 'upcoming'],
    ]);
    expect(o.completedTitles).toBe('C, G, D');
    expect(o.progress).toEqual({ done: 3, total: 12, label: '3 of 12 keys' });
    expect(o.upNext).toEqual({
      levelId: 'a-major',
      title: 'A major',
      stageTitle: null,
      blurb: 'Three sharps: F♯ · C♯ · G♯. Chords: A · Bm · C♯m · D · E · F♯m · G♯°',
      label: 'Start A major',
      route: '/practice/a-major',
    });
    expect(o.nodes?.[6]?.label).toBe('G♭');
    const minor = services.progress.trackOverview('minor-diatonic-chords');
    expect(minor.nodes?.[0]?.label).toBe('Am');
    expect(minor).toMatchObject({ hasLesson: true, lessonSeen: false, enrolled: false });
  });

  it('ladder: unlock gating, unlock copy at stage boundaries, next across stages', () => {
    const { services } = onboarded();
    const ear = 'ear-training';
    expect(services.progress.isStageUnlocked(ear, 'scale-degrees')).toBe(false);
    for (const id of ['intervals-1', 'intervals-2', 'intervals-3']) {
      playLevel(services, { levelId: id, kind: 'free' });
    }
    // {intervals, 4} is satisfied once level 3 is passed
    expect(services.progress.isStageUnlocked(ear, 'scale-degrees')).toBe(true);
    expect(services.progress.isLevelUnlocked('scale-degrees-1')).toBe(true);
    expect(services.progress.isLevelUnlocked('chord-quality-1')).toBe(false);
    const o = services.progress.trackOverview(ear);
    expect(o.stages?.map((s) => s.unlockText)).toEqual([
      null,
      null,
      'Unlocks at Intervals L5',
      'Unlocks at Scale degrees L4',
      'Unlocks after Chords in a key L2',
    ]);
    expect(o.stages?.[1]).toMatchObject({ state: 'open', progressText: 'Level 1 of 4' });
    // next in the same stage first
    expect(services.progress.nextLevel(ear, 'intervals-3')?.id).toBe('intervals-4');
    for (const id of ['intervals-4', 'intervals-5', 'intervals-6']) {
      playLevel(services, { levelId: id, kind: 'free' });
    }
    // stage done → first level of the next unlocked stage
    expect(services.progress.nextLevel(ear, 'intervals-6')?.id).toBe('scale-degrees-1');
    expect(services.progress.trackOverview(ear).stages?.[0]).toMatchObject({
      state: 'complete',
      progressText: 'Complete',
    });
  });

  it('ear-unlocked seed opens every ear stage, including Find the key', () => {
    const h = createHarness(EVENING);
    seed(h.services, 'ear-unlocked', { timezone: TZ });
    const o = h.services.progress.trackOverview('ear-training');
    expect(o.stages?.map((s) => s.state)).toEqual(['open', 'complete', 'open', 'open', 'open']);
    expect(o.stages?.every((s) => s.unlockText === null)).toBe(true);
    expect(h.services.progress.isLevelUnlocked('find-the-key-1')).toBe(true);
    // xp_total matches the ledger
    const today = h.services.clock.today(TZ);
    expect(h.services.xp.total()).toBe(h.services.repos.xp.sumByDay(today));
  });
});
