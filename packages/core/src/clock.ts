// engine.md §4: every service receives a Clock (`now()`, `today(timezone)`).
import { localDay } from './dates';
import type { Clock } from './ports';

const MS_PER_DAY = 86_400_000;

/** A clock that can be moved forward (FakeClock in tests, SystemClock's e2e offset). */
export interface AdjustableClock extends Clock {
  advanceDays(n: number): void;
}

export function isAdjustableClock(clock: Clock): clock is AdjustableClock {
  return typeof (clock as Partial<AdjustableClock>).advanceDays === 'function';
}

/**
 * Wall-clock time. `offsetMs` shifts "now" (e2e only: Task 05/09 persist an offset so
 * `dev.seed({scenario:'advance-day'})` can move "today" forward).
 */
export class SystemClock implements AdjustableClock {
  offsetMs: number;

  constructor(offsetMs = 0) {
    this.offsetMs = offsetMs;
  }

  now(): number {
    return Date.now() + this.offsetMs;
  }

  today(timezone: string): string {
    return localDay(this.now(), timezone);
  }

  advanceDays(n: number): void {
    this.offsetMs += n * MS_PER_DAY;
  }
}

/** A settable clock for tests and the seed. */
export class FakeClock implements AdjustableClock {
  private ms: number;

  constructor(start: number | string | Date) {
    this.ms = FakeClock.toMs(start);
  }

  private static toMs(t: number | string | Date): number {
    const ms = typeof t === 'number' ? t : typeof t === 'string' ? Date.parse(t) : t.getTime();
    if (Number.isNaN(ms)) throw new Error(`Invalid time: ${String(t)}`);
    return ms;
  }

  now(): number {
    return this.ms;
  }

  today(timezone: string): string {
    return localDay(this.ms, timezone);
  }

  /** Set "now" to an epoch-ms number, ISO string or Date. */
  set(t: number | string | Date): void {
    this.ms = FakeClock.toMs(t);
  }

  advanceMs(ms: number): void {
    this.ms += ms;
  }

  advanceMinutes(n: number): void {
    this.ms += n * 60_000;
  }

  advanceDays(n: number): void {
    this.ms += n * MS_PER_DAY;
  }
}
