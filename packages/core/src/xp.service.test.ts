import { describe, expect, it } from 'vitest';
import type { StepResult } from './ports';
import { onboarded } from './testing/harness';
import { LEVEL_XP, PLAYBACK_XP, STEP_XP, stepXp } from './xp.service';

function ledgerSum(h: ReturnType<typeof onboarded>, sessionIds: string[]): number {
  return sessionIds
    .flatMap((id) => h.services.repos.xp.listBySession(id))
    .reduce((n, e) => n + e.amount, 0);
}

// HANDOFF §5 XP and streak; engine.md §4 XpService, §6.2.
describe('XP rules', () => {
  it('step XP: 5 for clean/hinted/marked, 0 for skipped/wrong', () => {
    expect([STEP_XP, LEVEL_XP, PLAYBACK_XP]).toEqual([5, 40, 5]);
    const table: Array<[StepResult, number]> = [
      ['clean', 5],
      ['hinted', 5],
      ['marked', 5],
      ['skipped', 0],
      ['wrong', 0],
    ];
    for (const [r, xp] of table) expect(stepXp(r)).toBe(xp);
  });

  it('a chord level awards step XP live and 40 on finish; profile total matches the ledger', () => {
    const h = onboarded();
    const { progress, settings } = h.services;
    const s = progress.startLevel('c-major', 'learn');
    const results: StepResult[] = [
      'clean',
      'hinted',
      'marked',
      'skipped',
      'clean',
      'clean',
      'clean',
    ];
    const awarded = s.steps.map(
      (step, ordinal) =>
        progress.recordStep({
          sessionId: s.sessionId,
          stepId: step.id,
          ordinal,
          result: results[ordinal] ?? 'clean',
          hintLevel: 0,
        }).xpAwarded,
    );
    expect(awarded).toEqual([5, 5, 5, 0, 5, 5, 5]);
    const done = progress.finishSession({ sessionId: s.sessionId, durationMs: 60_000 });
    expect(done.xp).toEqual({ level: 40, steps: 30, playback: 0, total: 70, newTotal: 70 });
    expect(settings.me().xpTotal).toBe(70);
    expect(ledgerSum(h, [s.sessionId])).toBe(70);
  });

  it('level XP is awarded every time a chord level is finished', () => {
    const h = onboarded();
    const { progress } = h.services;
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const s = progress.startLevel('c-major', i === 0 ? 'learn' : 'review');
      ids.push(s.sessionId);
      s.steps.forEach((step, ordinal) =>
        progress.recordStep({
          sessionId: s.sessionId,
          stepId: step.id,
          ordinal,
          result: 'clean',
          hintLevel: 0,
        }),
      );
      expect(progress.finishSession({ sessionId: s.sessionId, durationMs: 1 }).xp.level).toBe(40);
    }
    expect(h.services.xp.total()).toBe(150);
    expect(ledgerSum(h, ids)).toBe(150);
  });

  it('ear: 5 per correct answer, 0 for wrong, 40 only when passed, playback once per question', () => {
    const h = onboarded();
    const { progress } = h.services;
    const s = progress.startLevel('intervals-1', 'learn');
    expect(s.questions).toHaveLength(10);
    s.questions.forEach((q) => {
      const wrong = q.ordinal >= 8; // 8 of 10 correct → pass
      const r = progress.recordStep({
        sessionId: s.sessionId,
        stepId: q.id,
        ordinal: q.ordinal,
        result: wrong ? 'wrong' : 'clean',
        hintLevel: 0,
      });
      expect(r.xpAwarded).toBe(wrong ? 0 : 5);
    });
    expect(progress.recordPlayback({ sessionId: s.sessionId, ordinal: 0 }).xpAwarded).toBe(5);
    expect(progress.recordPlayback({ sessionId: s.sessionId, ordinal: 0 }).xpAwarded).toBe(0);
    expect(progress.recordPlayback({ sessionId: s.sessionId, ordinal: 1 }).xpAwarded).toBe(5);
    const done = progress.finishSession({ sessionId: s.sessionId, durationMs: 1 });
    expect(done.passed).toBe(true);
    expect(done.correct).toBe(8);
    expect(done.xp).toEqual({ level: 40, steps: 40, playback: 10, total: 90, newTotal: 90 });

    const fail = progress.startLevel('intervals-2', 'learn');
    fail.questions.forEach((q) =>
      progress.recordStep({
        sessionId: fail.sessionId,
        stepId: q.id,
        ordinal: q.ordinal,
        result: q.ordinal < 7 ? 'clean' : 'wrong',
        hintLevel: 0,
      }),
    );
    const failed = progress.finishSession({ sessionId: fail.sessionId, durationMs: 1 });
    expect(failed.passed).toBe(false);
    expect(failed.title).toBe('Not yet — 7 of 10');
    expect(failed.xp.level).toBe(0);
    expect(failed.next).toBeNull();
    expect(h.services.xp.total()).toBe(90 + 35);
    expect(ledgerSum(h, [s.sessionId, fail.sessionId])).toBe(125);
  });

  it('recordStep is idempotent on (sessionId, ordinal): no double award or reschedule', () => {
    const h = onboarded();
    const { progress } = h.services;
    const s = progress.startLevel('c-major', 'learn');
    const input = {
      sessionId: s.sessionId,
      stepId: 'd1',
      ordinal: 0,
      result: 'clean',
      hintLevel: 0,
    } as const;
    const a = progress.recordStep(input);
    const b = progress.recordStep(input);
    expect(a.xpAwarded).toBe(5);
    expect(b).toEqual({ ...a, xpAwarded: 0 });
    expect(h.services.repos.sessions.listSteps(s.sessionId)).toHaveLength(1);
    expect(h.services.repos.stepProgress.get('c-major', 'd1')?.timesSeen).toBe(1);
    expect(h.services.xp.total()).toBe(5);
  });
});
