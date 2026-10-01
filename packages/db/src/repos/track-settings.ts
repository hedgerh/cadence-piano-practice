import { asc, eq } from 'drizzle-orm';
import type { TrackSettingsPatch, TrackSettingsRepo, TrackSettingsRow } from '@cadence/core';
import type { Db } from '../client';
import { trackSettings } from '../schema';

export function createTrackSettingsRepo(db: Db): TrackSettingsRepo {
  const get = (trackId: string): TrackSettingsRow | null =>
    db.select().from(trackSettings).where(eq(trackSettings.trackId, trackId)).get() ?? null;

  return {
    get,

    list(): TrackSettingsRow[] {
      return db
        .select()
        .from(trackSettings)
        .orderBy(asc(trackSettings.enrolledAt), asc(trackSettings.trackId))
        .all();
    },

    upsert(row: TrackSettingsRow): TrackSettingsRow {
      const { trackId: _key, ...rest } = row;
      return db
        .insert(trackSettings)
        .values(row)
        .onConflictDoUpdate({ target: trackSettings.trackId, set: rest })
        .returning()
        .get();
    },

    update(trackId: string, patch: TrackSettingsPatch): TrackSettingsRow | null {
      if (Object.keys(patch).length === 0) return get(trackId);
      return (
        db
          .update(trackSettings)
          .set(patch)
          .where(eq(trackSettings.trackId, trackId))
          .returning()
          .get() ?? null
      );
    },
  };
}
