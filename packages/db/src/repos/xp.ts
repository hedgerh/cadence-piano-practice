import { asc, eq, sum } from 'drizzle-orm';
import type { NewXpEntry, XpLedgerRow, XpRepo } from '@cadence/core';
import type { Db } from '../client';
import { xpLedger } from '../schema';
import { newId } from './ids';
import { createProfileRepo } from './profile';

export function createXpRepo(db: Db): XpRepo {
  const profile = createProfileRepo(db);

  return {
    // engine.md §4 XpService: ledger write + profile.xp_total increment in one transaction.
    award(input: NewXpEntry): { entry: XpLedgerRow; newTotal: number } {
      const { id, ...rest } = input;
      return db.transaction(() => {
        const entry = db
          .insert(xpLedger)
          .values({ id: id ?? newId(), ...rest })
          .returning()
          .get();
        const newTotal = profile.addXp(input.amount, input.createdAt);
        return { entry, newTotal };
      });
    },

    listBySession(sessionId: string): XpLedgerRow[] {
      return db
        .select()
        .from(xpLedger)
        .where(eq(xpLedger.sessionId, sessionId))
        .orderBy(asc(xpLedger.createdAt))
        .all();
    },

    listByDay(day: string): XpLedgerRow[] {
      return db
        .select()
        .from(xpLedger)
        .where(eq(xpLedger.day, day))
        .orderBy(asc(xpLedger.createdAt))
        .all();
    },

    sumByDay(day: string): number {
      const row = db
        .select({ total: sum(xpLedger.amount).mapWith(Number) })
        .from(xpLedger)
        .where(eq(xpLedger.day, day))
        .get();
      return row?.total ?? 0;
    },
  };
}
