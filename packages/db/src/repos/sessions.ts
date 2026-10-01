import { and, asc, eq, gte, lt } from 'drizzle-orm';
import type {
  NewSession,
  SessionPatch,
  SessionRepo,
  SessionRow,
  SessionStepRow,
  SessionStepUpsert,
} from '@cadence/core';
import type { Db } from '../client';
import { sessionSteps, sessions } from '../schema';
import { newId } from './ids';

export function createSessionRepo(db: Db): SessionRepo {
  const get = (id: string): SessionRow | null =>
    db.select().from(sessions).where(eq(sessions.id, id)).get() ?? null;

  return {
    create(input: NewSession): SessionRow {
      const { id, ...rest } = input;
      return db
        .insert(sessions)
        .values({ id: id ?? newId(), ...rest })
        .returning()
        .get();
    },

    get,

    update(id: string, patch: SessionPatch): SessionRow | null {
      if (Object.keys(patch).length === 0) return get(id);
      return db.update(sessions).set(patch).where(eq(sessions.id, id)).returning().get() ?? null;
    },

    listByLevel(levelId: string): SessionRow[] {
      return db
        .select()
        .from(sessions)
        .where(eq(sessions.levelId, levelId))
        .orderBy(asc(sessions.startedAt))
        .all();
    },

    listStartedBetween(fromMs: number, toMs: number): SessionRow[] {
      return db
        .select()
        .from(sessions)
        .where(and(gte(sessions.startedAt, fromMs), lt(sessions.startedAt, toMs)))
        .orderBy(asc(sessions.startedAt))
        .all();
    },

    upsertStep(step: SessionStepUpsert): SessionStepRow {
      const { id, sessionId, ordinal, createdAt, playedBack, ...fields } = step;
      const replay = playedBack === undefined ? {} : { playedBack };
      return db
        .insert(sessionSteps)
        .values({ id: id ?? newId(), sessionId, ordinal, createdAt, ...fields, ...replay })
        .onConflictDoUpdate({
          target: [sessionSteps.sessionId, sessionSteps.ordinal],
          set: { ...fields, ...replay },
        })
        .returning()
        .get();
    },

    listSteps(sessionId: string): SessionStepRow[] {
      return db
        .select()
        .from(sessionSteps)
        .where(eq(sessionSteps.sessionId, sessionId))
        .orderBy(asc(sessionSteps.ordinal))
        .all();
    },

    markPlayedBack(sessionId: string, ordinal: number): boolean {
      const result = db
        .update(sessionSteps)
        .set({ playedBack: true })
        .where(
          and(
            eq(sessionSteps.sessionId, sessionId),
            eq(sessionSteps.ordinal, ordinal),
            eq(sessionSteps.playedBack, false),
          ),
        )
        .run();
      return result.changes > 0;
    },
  };
}
