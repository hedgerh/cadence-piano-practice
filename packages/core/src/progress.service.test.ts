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

  it('a minor-scale level completes with scale copy (HANDOFF §4 sequence steps)', () => {
    const { services } = onboarded();
    const s = services.progress.startLevel('a-minor-scale', 'learn');
    expect(s.steps.map((step) => step.id)).toEqual(['up', 'down']);
    // decisions.md 2026-10-10: the content note rides on the session for the Practice screen.
    expect(s.levelNote).toBe('Relative major: **C major**. Same seven notes, starting on C.');
    expect(services.progress.startLevel('c-major', 'learn').levelNote).toBeNull();
    s.steps.forEach((step, ordinal) =>
      services.progress.recordStep({
        sessionId: s.sessionId,
        stepId: step.id,
        ordinal,
        result: 'clean',
        hintLevel: 0,
      }),
    );
    const done = services.progress.finishSession({ sessionId: s.sessionId, durationMs: 40_000 });
    expect(done).toMatchObject({
      completed: true,
      stepNoun: 'scale',
      total: 2,
      cleanCount: 2,
      title: 'A minor, complete',
      subtitle: "Up and down, every note in order. That's your first key on the circle.",
    });
    expect(done.track).toMatchObject({ id: 'minor-scales', unit: 'keys', nextTitle: 'E minor' });
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

// docs/decisions.md "Ear level replay" (HANDOFF §5 review scheduling): a `review` session on a
// passed ladder level records XP and reschedules steps like any session, but the level stays
// passed, the ladder's current level does not move, and only a same-level plan block is touched.
describe('ear level replay (review kind)', () => {
  function answerAll(
    services: ReturnType<typeof onboarded>['services'],
    sessionId: string,
    questions: readonly { id: string; ordinal: number }[],
    result: 'clean' | 'wrong',
  ): void {
    for (const q of questions) {
      services.progress.recordStep({
        sessionId,
        stepId: q.id,
        ordinal: q.ordinal,
        result,
        hintLevel: 0,
      });
    }
  }

  it('overview levels carry ids, titles, blurbs and done state for replay', () => {
    const { services } = onboarded();
    for (const id of ['intervals-1', 'intervals-2'])
      playLevel(services, { levelId: id, kind: 'learn' });
    const intervals = services.progress.trackOverview('ear-training').stages?.[0];
    expect(intervals?.levels.slice(0, 3)).toEqual([
      {
        levelId: 'intervals-1',
        title: 'Level 1',
        blurb: 'Unison, perfect 5th and octave, going up from C.',
        number: 1,
        state: 'done',
      },
      expect.objectContaining({ levelId: 'intervals-2', state: 'done' }),
      expect.objectContaining({ levelId: 'intervals-3', state: 'current' }),
    ]);
  });

  it('a failed replay records XP and reschedules, but the level stays passed', () => {
    const { services, clock } = onboarded();
    for (const id of ['intervals-1', 'intervals-2'])
      playLevel(services, { levelId: id, kind: 'learn' });
    const plan = services.plan.getToday().blocks.map((b) => [b.id, b.status]);
    const before = services.repos.levelProgress.get('intervals-1');
    const xpBefore = services.xp.total();
    clock.advanceMinutes(30);

    const s = services.progress.startLevel('intervals-1', 'review');
    expect(services.repos.sessions.get(s.sessionId)).toMatchObject({
      kind: 'review',
      planBlockId: null,
    });
    answerAll(services, s.sessionId, s.questions, 'wrong');
    const done = services.progress.finishSession({ sessionId: s.sessionId, durationMs: 60_000 });

    expect(done).toMatchObject({ kind: 'review', passed: false, xp: { level: 0 } });
    expect(services.xp.total()).toBeGreaterThanOrEqual(xpBefore);
    expect(services.repos.levelProgress.get('intervals-1')).toMatchObject({
      status: 'completed',
      firstCompletedAt: before?.firstCompletedAt,
      lastCompletedAt: before?.lastCompletedAt,
      attempts: (before?.attempts ?? 0) + 1,
    });
    // Misses come back tomorrow (engine.md §4 ReviewService).
    const today = services.clock.today(TZ);
    const rows = services.repos.stepProgress.listByLevel('intervals-1');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.lastResult).toBe('wrong');
      expect(row.intervalDays).toBe(1);
      expect((row.dueOn ?? '') > today).toBe(true);
    }
    // Unrelated plan blocks are untouched; the current level does not move.
    expect(services.plan.getToday().blocks.map((b) => [b.id, b.status])).toEqual(plan);
    expect(services.progress.currentLevel('ear-training')?.id).toBe('intervals-3');
    expect(services.progress.trackOverview('ear-training').stages?.[0]?.progressText).toBe(
      'Level 3 of 6',
    );
  });

  it('a passed replay earns step + level XP and offers the current level next', () => {
    const { services, clock } = onboarded();
    for (const id of ['intervals-1', 'intervals-2'])
      playLevel(services, { levelId: id, kind: 'learn' });
    clock.advanceMinutes(30);
    const s = services.progress.startLevel('intervals-1', 'review');
    answerAll(services, s.sessionId, s.questions, 'clean');
    const done = services.progress.finishSession({ sessionId: s.sessionId, durationMs: 60_000 });
    expect(done).toMatchObject({
      kind: 'review',
      passed: true,
      firstCompletion: false,
      track: { done: 2 },
      next: { levelId: 'intervals-3', label: 'Keep going — Level 3' },
    });
    expect(done.xp.steps).toBeGreaterThan(0);
    expect(services.repos.levelProgress.get('intervals-1')?.status).toBe('completed');
    expect(services.progress.currentLevel('ear-training')?.id).toBe('intervals-3');
  });
});

// engine.md §4 focus rounds ("Drill what you missed").
describe('focus rounds', () => {
  type Svc = ReturnType<typeof onboarded>['services'];
  const answerAll = (svc: Svc, sessionId: string, wrong: (label: string) => boolean): void => {
    const s = svc.progress.getSession(sessionId);
    for (const q of s.questions) {
      svc.progress.recordStep({
        sessionId,
        stepId: q.id,
        ordinal: q.ordinal,
        result: wrong(q.label) ? 'wrong' : 'clean',
        hintLevel: 0,
      });
    }
  };

  it('drills the misses and their interval neighbours; never passes or completes', () => {
    const { services } = onboarded();
    const first = services.progress.startLevel('intervals-3', 'learn');
    const missedLabels = new Set(first.questions.map((q) => q.label).filter((l) => l === 'P4'));
    answerAll(services, first.sessionId, (l) => l === 'P4');
    services.progress.finishSession({ sessionId: first.sessionId, durationMs: 1 });
    const before = services.repos.levelProgress.get('intervals-3');
    expect(missedLabels.size).toBe(1); // the L3 pool always shows P4 (unseen → once)

    const focus = services.progress.startLevel('intervals-3', 'free', undefined, 'misses');
    expect(focus.focus).toBe('misses');
    expect(focus.resumed).toBe(false);
    expect(focus.questions).toHaveLength(10);
    // P4 (5 semitones) ± 1–2 among L3's options: m3, M3, P5.
    for (const q of focus.questions) expect(['m3', 'M3', 'P4', 'P5']).toContain(q.label);
    expect(focus.questions.filter((q) => q.label === 'P4').length).toBeGreaterThanOrEqual(3);

    answerAll(services, focus.sessionId, () => false);
    const done = services.progress.finishSession({ sessionId: focus.sessionId, durationMs: 1 });
    expect(done).toMatchObject({
      focus: 'misses',
      title: 'Focus round',
      subtitle: '10 of 10 right.',
      completed: false,
      passed: false,
      next: null,
      correct: 10,
    });
    expect(done.xp.level).toBe(0);
    expect(done.xp.steps).toBe(50);
    expect(services.repos.sessions.get(focus.sessionId)?.passed).toBeNull();
    expect(services.repos.levelProgress.get('intervals-3')).toEqual(before);
    expect(services.progress.lastFinishedSession('intervals-3')?.id).toBe(first.sessionId);
  });

  it('a failed level stays unpassed after a perfect focus round', () => {
    const { services } = onboarded();
    const first = services.progress.startLevel('intervals-2', 'learn');
    answerAll(services, first.sessionId, () => true);
    services.progress.finishSession({ sessionId: first.sessionId, durationMs: 1 });
    const focus = services.progress.startLevel('intervals-2', 'free', undefined, 'misses');
    answerAll(services, focus.sessionId, () => false);
    services.progress.finishSession({ sessionId: focus.sessionId, durationMs: 1 });
    expect(services.progress.isCompleted('intervals-2')).toBe(false);
    expect(services.repos.levelProgress.get('intervals-2')?.status).toBe('in_progress');
  });

  it('an open focus round is not resumed by a normal start (and vice versa)', () => {
    const { services } = onboarded();
    const focus = services.progress.startLevel('intervals-1', 'free', undefined, 'misses');
    const normal = services.progress.startLevel('intervals-1', 'learn');
    expect(normal.sessionId).not.toBe(focus.sessionId);
    expect(normal.focus).toBeNull();
    const again = services.progress.startLevel('intervals-1', 'free', undefined, 'misses');
    expect(again.sessionId).toBe(focus.sessionId);
  });
});

// decisions.md 2026-10-03 circle run: play every key in circle order regardless of completion.
describe('circle run', () => {
  const TRACK = 'major-diatonic-chords';

  /** Start a level as part of the run, play every step clean, finish. */
  const playRun = (services: ReturnType<typeof onboarded>['services'], levelId: string) => {
    const s = services.progress.startLevel(levelId, 'learn', undefined, undefined, 'circle');
    s.steps.forEach((step, ordinal) =>
      services.progress.recordStep({
        sessionId: s.sessionId,
        stepId: step.id,
        ordinal,
        result: 'clean',
        hintLevel: 0,
      }),
    );
    return {
      session: s,
      complete: services.progress.finishSession({ sessionId: s.sessionId, durationMs: 60_000 }),
    };
  };

  const day8 = () => {
    const h = createHarness();
    seed(h.services, 'day8', { timezone: TZ });
    return h;
  };

  it('a run from C walks the whole circle in order (… B → G♭ … F) and ends with null', () => {
    const { services } = onboarded();
    const order = services.content.levelOrder(TRACK).map((l) => l.id);
    expect(order[0]).toBe('c-major');
    const visited: string[] = [];
    let levelId: string | null = 'c-major';
    while (levelId !== null) {
      const { session, complete } = playRun(services, levelId);
      expect(session.run).toBe('circle');
      expect(complete.run).toBe('circle');
      expect(complete.runPosition).toBe(visited.length + 1);
      visited.push(levelId);
      if (levelId === 'b-major') {
        expect(complete.next).toEqual({
          levelId: 'gb-major',
          label: 'Keep going — G♭ major',
          route: '/practice/gb-major',
          run: 'circle',
        });
      }
      if (complete.next) expect(complete.next.run).toBe('circle');
      levelId = complete.next?.levelId ?? null;
    }
    expect(visited).toEqual(order);
    expect(visited.at(-1)).toBe('f-major');
    expect(services.progress.completedCount(TRACK)).toBe(12);
  });

  it('kind: review on a completed key, learn on an uncompleted one (still claims the plan block)', () => {
    const { services } = day8();
    const c = services.progress.startLevel('c-major', 'learn', undefined, undefined, 'circle');
    expect(c.kind).toBe('review');
    expect(c.run).toBe('circle');
    const a = services.progress.startLevel('a-major', 'review', undefined, undefined, 'circle');
    expect(a.kind).toBe('learn');
    const block = services.repos.plans
      .get(services.plan.getToday().day)
      ?.blocks.find((b) => b.levelId === 'a-major');
    expect(block).toMatchObject({ status: 'in_progress', sessionId: a.sessionId });
    expect(services.repos.sessions.get(a.sessionId)?.run).toBe('circle');
  });

  it('next ignores completion; a one-off session still goes to the next uncompleted key', () => {
    const { services } = day8();
    // G is completed in day8: the run goes there anyway.
    expect(playRun(services, 'c-major').complete.next?.levelId).toBe('g-major');
    const oneOff = services.progress.startLevel('g-major', 'review');
    expect(oneOff.run).toBeNull();
    oneOff.steps.forEach((step, ordinal) =>
      services.progress.recordStep({
        sessionId: oneOff.sessionId,
        stepId: step.id,
        ordinal,
        result: 'clean',
        hintLevel: 0,
      }),
    );
    const done = services.progress.finishSession({ sessionId: oneOff.sessionId, durationMs: 1 });
    expect(done.run).toBeNull();
    expect(done.runPosition).toBeNull();
    expect(done.next).toMatchObject({ levelId: 'a-major', run: null });
  });

  it('the last key in circle order ends the run (F major, D minor)', () => {
    const { services } = day8();
    expect(playRun(services, 'f-major').complete).toMatchObject({
      next: null,
      run: 'circle',
      runPosition: 12,
    });
    const order = services.content.levelOrder('minor-diatonic-chords').map((l) => l.id);
    expect(order.at(-1)).toBe('d-minor');
    expect(playRun(services, 'd-minor').complete.next).toBeNull();
  });

  it('a resumed session joins or leaves the run the learner asked for; ladders ignore run', () => {
    const { services } = day8();
    const run = services.progress.startLevel('e-major', 'learn', undefined, undefined, 'circle');
    const oneOff = services.progress.startLevel('e-major', 'learn');
    expect(oneOff.sessionId).toBe(run.sessionId);
    expect(oneOff.run).toBeNull();
    const again = services.progress.startLevel('e-major', 'learn', undefined, undefined, 'circle');
    expect(again.sessionId).toBe(run.sessionId);
    expect(again.run).toBe('circle');
    const ear = services.progress.startLevel(
      'intervals-3',
      'learn',
      undefined,
      undefined,
      'circle',
    );
    expect(ear.run).toBeNull();
  });
});
