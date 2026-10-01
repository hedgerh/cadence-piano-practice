// HANDOFF §5 streak, refined by engine.md §4 StreakService: consecutive local days ending
// today with blocks_completed > 0; if today has none yet, count through yesterday and flag
// `atRisk`. No streak freeze in v1.
import { type ServiceContext, todayOf } from './context';
import { addDays } from './dates';
import type { DayLogRow } from './ports';
import type { StreakDto } from './dto';

const WINDOW_DAYS = 60;

export interface StreakService {
  logCompletion(
    day: string,
    counts: { blocks: number; sessions: number; xp: number },
    at?: number,
  ): DayLogRow;
  /** The streak as of `today` (defaults to the profile's local today). */
  current(today?: string): StreakDto;
}

export function createStreakService(ctx: ServiceContext): StreakService {
  const { repos, clock } = ctx;

  const counted = (row: DayLogRow | undefined): boolean => (row?.blocksCompleted ?? 0) > 0;

  /** Consecutive counted days ending at `end` (inclusive), walking back in windows. */
  const runEndingAt = (end: string): number => {
    let days = 0;
    let cursor = end;
    for (;;) {
      const from = addDays(cursor, -(WINDOW_DAYS - 1));
      const rows = new Map(repos.dayLog.listRange(from, cursor).map((r) => [r.day, r]));
      for (let i = 0; i < WINDOW_DAYS; i++) {
        const day = addDays(cursor, -i);
        if (!counted(rows.get(day))) return days;
        days++;
      }
      cursor = addDays(from, -1);
    }
  };

  return {
    logCompletion(day, { blocks, sessions, xp }, at = clock.now()) {
      return repos.dayLog.increment({ day, blocks, sessions, xp, at });
    },

    current(today = todayOf(ctx)) {
      const keptToday = counted(repos.dayLog.get(today) ?? undefined);
      const days = runEndingAt(keptToday ? today : addDays(today, -1));
      return { days, keptToday, atRisk: !keptToday };
    },
  };
}
