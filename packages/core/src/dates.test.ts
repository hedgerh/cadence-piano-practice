import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, localDay } from './dates';

// CLAUDE.md "Windows notes" / engine.md §4: local dates via Intl.DateTimeFormat.
describe('localDay', () => {
  const instant = Date.parse('2026-03-08T07:30:00Z');

  it('uses the local day in America/Los_Angeles', () => {
    expect(localDay(instant, 'America/Los_Angeles')).toBe('2026-03-07');
  });

  it('uses the local day in Europe/Berlin', () => {
    expect(localDay(instant, 'Europe/Berlin')).toBe('2026-03-08');
  });

  it('handles UTC and local midnight boundaries', () => {
    expect(localDay(Date.parse('2026-01-01T00:00:00Z'), 'UTC')).toBe('2026-01-01');
    // 23:30 vs 00:30 local in Los Angeles (PST = UTC−8)
    expect(localDay(Date.parse('2026-01-02T07:30:00Z'), 'America/Los_Angeles')).toBe('2026-01-01');
    expect(localDay(Date.parse('2026-01-02T08:30:00Z'), 'America/Los_Angeles')).toBe('2026-01-02');
  });
});

describe('addDays', () => {
  it('adds and subtracts across month, year and leap-day boundaries', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-07', 30)).toBe('2026-04-06');
    expect(addDays('2026-03-07', 0)).toBe('2026-03-07');
  });

  it('is unaffected by DST transitions', () => {
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('rejects malformed days', () => {
    expect(() => addDays('2026-3-7', 1)).toThrow(/Invalid day/);
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days', () => {
    expect(daysBetween('2026-03-07', '2026-03-08')).toBe(1);
    expect(daysBetween('2026-03-08', '2026-03-07')).toBe(-1);
    expect(daysBetween('2026-03-07', '2026-03-07')).toBe(0);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
    expect(daysBetween('2028-01-01', '2029-01-01')).toBe(366);
  });

  it('round-trips with addDays', () => {
    expect(daysBetween('2026-03-07', addDays('2026-03-07', 45))).toBe(45);
  });
});
