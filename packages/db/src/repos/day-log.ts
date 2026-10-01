import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import type { DayLogIncrement, DayLogRepo, DayLogRow } from '@cadence/core';
import type { Db } from '../client';
import { dayLog } from '../schema';

export function createDayLogRepo(db: Db): DayLogRepo {
  return {
    get(day: string): DayLogRow | null {
      return db.select().from(dayLog).where(eq(dayLog.day, day)).get() ?? null;
    },

    listRange(fromDay: string, toDay: string): DayLogRow[] {
      return db
        .select()
        .from(dayLog)
        .where(and(gte(dayLog.day, fromDay), lte(dayLog.day, toDay)))
        .orderBy(asc(dayLog.day))
        .all();
    },

    upsert(row: DayLogRow): DayLogRow {
      const { day: _key, ...rest } = row;
      return db
        .insert(dayLog)
        .values(row)
        .onConflictDoUpdate({ target: dayLog.day, set: rest })
        .returning()
        .get();
    },

    increment({ day, blocks, sessions, xp, at }: DayLogIncrement): DayLogRow {
      return db
        .insert(dayLog)
        .values({
          day,
          blocksCompleted: blocks,
          sessionsCompleted: sessions,
          xp,
          firstCompletedAt: at,
        })
        .onConflictDoUpdate({
          target: dayLog.day,
          set: {
            blocksCompleted: sql`${dayLog.blocksCompleted} + ${blocks}`,
            sessionsCompleted: sql`${dayLog.sessionsCompleted} + ${sessions}`,
            xp: sql`${dayLog.xp} + ${xp}`,
          },
        })
        .returning()
        .get();
    },
  };
}
