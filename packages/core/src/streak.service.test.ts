import { describe, expect, it } from 'vitest';
import { FakeClock } from './clock';
import { addDays } from './dates';
import { createServices } from './services';
import { createMemoryRepos } from './testing/memoryRepos';
import { TZ, testContent } from './testing/harness';

function at(iso: string) {
  const clock = new FakeClock(iso);
  const services = createServices({ repos: createMemoryRepos(), content: testContent(), clock });
  services.settings.createProfile({ name: 'Harry', timezone: TZ });
  return { services, clock };
}

/** Finish C major as a free session at the clock's current time. */
function finishLevel(services: ReturnType<typeof at>['services']): void {
  const s = services.progress.startLevel('c-major', 'free');
  s.steps.forEach((step, ordinal) =>
    services.progress.recordStep({
      sessionId: s.sessionId,
      stepId: step.id,
      ordinal,
      result: 'clean',
      hintLevel: 0,
    }),
  );
  services.progress.finishSession({ sessionId: s.sessionId, durationMs: 1 });
}

// HANDOFF §5 streak; engine.md §4 StreakService and §4.T (local midnight).
describe('StreakService', () => {
  it('23:30 and 00:30 local in America/Los_Angeles count as two days', () => {
    // 2026-01-01 23:30 PST = 2026-01-02T07:30Z; next day 00:30 PST = 08:30Z.
    const { services, clock } = at('2026-01-02T07:30:00Z');
    finishLevel(services);
    expect(services.repos.dayLog.get('2026-01-01')?.blocksCompleted).toBe(1);
    clock.set('2026-01-02T08:30:00Z');
    finishLevel(services);
    expect(services.repos.dayLog.get('2026-01-02')?.blocksCompleted).toBe(1);
    expect(services.streak.current()).toEqual({ days: 2, keptToday: true, atRisk: false });
  });

  it('the same instants in UTC would be one day (the timezone matters)', () => {
    const { services } = at('2026-01-02T07:30:00Z');
    expect(services.clock.today('UTC')).toBe('2026-01-02');
    expect(services.clock.today(TZ)).toBe('2026-01-01');
  });

  it('a missed day resets the streak', () => {
    const { services, clock } = at('2026-03-01T20:00:00Z');
    finishLevel(services);
    clock.advanceDays(1);
    finishLevel(services);
    expect(services.streak.current().days).toBe(2);
    clock.advanceDays(2); // skip a day
    expect(services.streak.current()).toEqual({ days: 0, keptToday: false, atRisk: true });
    finishLevel(services);
    expect(services.streak.current()).toEqual({ days: 1, keptToday: true, atRisk: false });
  });

  it('atRisk is true when today has no completion yet (counting through yesterday)', () => {
    const { services, clock } = at('2026-03-01T20:00:00Z');
    for (let i = 0; i < 3; i++) {
      finishLevel(services);
      clock.advanceDays(1);
    }
    expect(services.streak.current()).toEqual({ days: 3, keptToday: false, atRisk: true });
  });

  it('counts long streaks across lookup windows', () => {
    const { services } = at('2026-06-01T20:00:00Z');
    const today = services.clock.today(TZ);
    let d = today;
    for (let i = 0; i < 130; i++) {
      services.streak.logCompletion(d, { blocks: 1, sessions: 1, xp: 0 });
      d = addDays(d, -1);
    }
    expect(services.streak.current().days).toBe(130);
  });

  it('a failed ear attempt does not count; a day needs a completed level', () => {
    const { services } = at('2026-03-01T20:00:00Z');
    const s = services.progress.startLevel('intervals-1', 'learn');
    s.questions.forEach((q) =>
      services.progress.recordStep({
        sessionId: s.sessionId,
        stepId: q.id,
        ordinal: q.ordinal,
        result: 'wrong',
        hintLevel: 0,
      }),
    );
    services.progress.finishSession({ sessionId: s.sessionId, durationMs: 1 });
    expect(services.streak.current()).toEqual({ days: 0, keptToday: false, atRisk: true });
  });
});
