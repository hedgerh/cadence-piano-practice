import { describe, expect, it } from 'vitest';
import { FakeClock, SystemClock, isAdjustableClock } from './clock';
import { localHour, localNoon } from './dates';

describe('clocks', () => {
  it('FakeClock is settable and advances by days in the profile timezone', () => {
    const c = new FakeClock('2026-01-02T07:30:00Z');
    expect(c.today('America/Los_Angeles')).toBe('2026-01-01');
    c.advanceMinutes(60);
    expect(c.today('America/Los_Angeles')).toBe('2026-01-02');
    c.set(0);
    expect(c.now()).toBe(0);
    c.advanceDays(2);
    expect(c.today('UTC')).toBe('1970-01-03');
    expect(() => new FakeClock('nonsense')).toThrow();
  });

  it('SystemClock applies its offset (e2e "advance-day")', () => {
    const c = new SystemClock();
    const before = c.now();
    c.advanceDays(1);
    expect(c.offsetMs).toBe(86_400_000);
    expect(c.now() - before).toBeGreaterThanOrEqual(86_400_000);
    expect(isAdjustableClock(c)).toBe(true);
    expect(isAdjustableClock({ now: () => 0, today: () => '' })).toBe(false);
  });

  it('localHour / localNoon use the timezone', () => {
    expect(localHour(Date.parse('2026-10-02T02:00:00Z'), 'America/Los_Angeles')).toBe(19);
    const noon = localNoon('2026-03-08', 'America/Los_Angeles', Date.parse('2026-03-08T00:00:00Z'));
    expect(localHour(noon, 'America/Los_Angeles')).toBe(12);
    expect(new Date(noon).toISOString()).toBe('2026-03-08T19:00:00.000Z'); // PDT after the switch
  });
});
