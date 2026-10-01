import { eq, sql } from 'drizzle-orm';
import type { NewProfile, ProfilePatch, ProfileRepo, ProfileRow } from '@cadence/core';
import type { Db } from '../client';
import { profile } from '../schema';

/** Single local profile (docs/engine.md §3). */
export const PROFILE_ID = 'local';

function mustExist<T>(row: T | undefined): T {
  if (!row) throw new Error('Profile does not exist');
  return row;
}

export function createProfileRepo(db: Db): ProfileRepo {
  return {
    get(): ProfileRow | null {
      return db.select().from(profile).where(eq(profile.id, PROFILE_ID)).get() ?? null;
    },

    create({ name, timezone, now }: NewProfile): ProfileRow {
      return db
        .insert(profile)
        .values({ id: PROFILE_ID, name, timezone, xpTotal: 0, createdAt: now, updatedAt: now })
        .returning()
        .get();
    },

    update(patch: ProfilePatch, now: number): ProfileRow {
      return mustExist(
        db
          .update(profile)
          .set({ ...patch, updatedAt: now })
          .where(eq(profile.id, PROFILE_ID))
          .returning()
          .get(),
      );
    },

    addXp(amount: number, now: number): number {
      return mustExist(
        db
          .update(profile)
          .set({ xpTotal: sql`${profile.xpTotal} + ${amount}`, updatedAt: now })
          .where(eq(profile.id, PROFILE_ID))
          .returning({ xpTotal: profile.xpTotal })
          .get(),
      ).xpTotal;
    },
  };
}
