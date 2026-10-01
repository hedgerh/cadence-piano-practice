import { asc, eq } from 'drizzle-orm';
import type { LevelProgressRepo, LevelProgressRow } from '@cadence/core';
import type { Db } from '../client';
import { levelProgress } from '../schema';

export function createLevelProgressRepo(db: Db): LevelProgressRepo {
  return {
    get(levelId: string): LevelProgressRow | null {
      return (
        db.select().from(levelProgress).where(eq(levelProgress.levelId, levelId)).get() ?? null
      );
    },

    listByTrack(trackId: string): LevelProgressRow[] {
      return db
        .select()
        .from(levelProgress)
        .where(eq(levelProgress.trackId, trackId))
        .orderBy(asc(levelProgress.levelId))
        .all();
    },

    listAll(): LevelProgressRow[] {
      return db.select().from(levelProgress).orderBy(asc(levelProgress.levelId)).all();
    },

    listMastered(): LevelProgressRow[] {
      return db
        .select()
        .from(levelProgress)
        .where(eq(levelProgress.mastered, true))
        .orderBy(asc(levelProgress.levelId))
        .all();
    },

    upsert(row: LevelProgressRow): LevelProgressRow {
      const { levelId: _key, ...rest } = row;
      return db
        .insert(levelProgress)
        .values(row)
        .onConflictDoUpdate({ target: levelProgress.levelId, set: rest })
        .returning()
        .get();
    },
  };
}
