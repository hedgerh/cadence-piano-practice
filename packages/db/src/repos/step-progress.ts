import { and, asc, count, eq, isNotNull, lte, min } from 'drizzle-orm';
import type {
  DueCount,
  StepProgressRepo,
  StepProgressRow,
  StepProgressUpsert,
} from '@cadence/core';
import type { Db } from '../client';
import { stepProgress } from '../schema';
import { newId } from './ids';

export function createStepProgressRepo(db: Db): StepProgressRepo {
  const isDue = (today: string) =>
    and(isNotNull(stepProgress.dueOn), lte(stepProgress.dueOn, today));

  return {
    get(levelId: string, stepId: string): StepProgressRow | null {
      return (
        db
          .select()
          .from(stepProgress)
          .where(and(eq(stepProgress.levelId, levelId), eq(stepProgress.stepId, stepId)))
          .get() ?? null
      );
    },

    listByLevel(levelId: string): StepProgressRow[] {
      return db
        .select()
        .from(stepProgress)
        .where(eq(stepProgress.levelId, levelId))
        .orderBy(asc(stepProgress.stepId))
        .all();
    },

    listByTrack(trackId: string): StepProgressRow[] {
      return db
        .select()
        .from(stepProgress)
        .where(eq(stepProgress.trackId, trackId))
        .orderBy(asc(stepProgress.levelId), asc(stepProgress.stepId))
        .all();
    },

    listDue(today: string): StepProgressRow[] {
      return db
        .select()
        .from(stepProgress)
        .where(isDue(today))
        .orderBy(asc(stepProgress.dueOn), asc(stepProgress.levelId), asc(stepProgress.stepId))
        .all();
    },

    dueCountByLevel(today: string): DueCount[] {
      const rows = db
        .select({
          levelId: stepProgress.levelId,
          trackId: stepProgress.trackId,
          count: count(),
          earliestDueOn: min(stepProgress.dueOn),
        })
        .from(stepProgress)
        .where(isDue(today))
        .groupBy(stepProgress.levelId, stepProgress.trackId)
        .orderBy(asc(stepProgress.levelId))
        .all();
      // earliestDueOn is never null here: the WHERE clause excludes null due_on.
      return rows.map((r) => ({ ...r, earliestDueOn: r.earliestDueOn ?? today }));
    },

    upsert(row: StepProgressUpsert): StepProgressRow {
      const { levelId: _l, stepId: _s, createdAt: _c, ...rest } = row;
      return db
        .insert(stepProgress)
        .values({ id: newId(), ...row })
        .onConflictDoUpdate({ target: [stepProgress.levelId, stepProgress.stepId], set: rest })
        .returning()
        .get();
    },
  };
}
