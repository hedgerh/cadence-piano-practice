import { asc, eq } from 'drizzle-orm';
import type {
  DailyPlanRow,
  NewPlanBlock,
  PlanBlockPatch,
  PlanBlockRow,
  PlanRepo,
  PlanWithBlocks,
} from '@cadence/core';
import type { Db } from '../client';
import { dailyPlans, planBlocks } from '../schema';
import { newId } from './ids';

export function createPlanRepo(db: Db): PlanRepo {
  const getBlock = (id: string): PlanBlockRow | null =>
    db.select().from(planBlocks).where(eq(planBlocks.id, id)).get() ?? null;

  const get = (day: string): PlanWithBlocks | null => {
    const plan = db.select().from(dailyPlans).where(eq(dailyPlans.day, day)).get();
    if (!plan) return null;
    const blocks = db
      .select()
      .from(planBlocks)
      .where(eq(planBlocks.day, day))
      .orderBy(asc(planBlocks.slot))
      .all();
    return { plan, blocks };
  };

  return {
    get,

    save(plan: DailyPlanRow, blocks: NewPlanBlock[]): PlanWithBlocks {
      return db.transaction(() => {
        const { day: _day, ...planRest } = plan;
        db.insert(dailyPlans)
          .values(plan)
          .onConflictDoUpdate({ target: dailyPlans.day, set: planRest })
          .run();
        for (const block of blocks) {
          if (block.day !== plan.day) {
            throw new Error(`Plan block for ${block.day} saved with plan for ${plan.day}`);
          }
          const { id, day: _d, slot: _s, ...rest } = block;
          db.insert(planBlocks)
            .values({ ...block, id: id ?? newId() })
            .onConflictDoUpdate({ target: [planBlocks.day, planBlocks.slot], set: rest })
            .run();
        }
        const saved = get(plan.day);
        if (!saved) throw new Error(`Plan for ${plan.day} was not saved`);
        return saved;
      });
    },

    getBlock,

    updateBlock(id: string, patch: PlanBlockPatch): PlanBlockRow | null {
      if (Object.keys(patch).length === 0) return getBlock(id);
      return (
        db.update(planBlocks).set(patch).where(eq(planBlocks.id, id)).returning().get() ?? null
      );
    },
  };
}
