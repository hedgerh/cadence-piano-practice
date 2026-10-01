import type { Repos } from '@cadence/core';
import type { Db } from '../client';
import { createDayLogRepo } from './day-log';
import { createLevelProgressRepo } from './level-progress';
import { createPlanRepo } from './plans';
import { createProfileRepo } from './profile';
import { createSessionRepo } from './sessions';
import { createStepProgressRepo } from './step-progress';
import { createTrackSettingsRepo } from './track-settings';
import { createXpRepo } from './xp';

export { PROFILE_ID } from './profile';
export {
  createDayLogRepo,
  createLevelProgressRepo,
  createPlanRepo,
  createProfileRepo,
  createSessionRepo,
  createStepProgressRepo,
  createTrackSettingsRepo,
  createXpRepo,
};

/** All repositories over one connection. `transaction` is synchronous and nests as a savepoint. */
export function createRepos(db: Db): Repos {
  return {
    profile: createProfileRepo(db),
    trackSettings: createTrackSettingsRepo(db),
    stepProgress: createStepProgressRepo(db),
    levelProgress: createLevelProgressRepo(db),
    sessions: createSessionRepo(db),
    xp: createXpRepo(db),
    dayLog: createDayLogRepo(db),
    plans: createPlanRepo(db),
    transaction: <T>(fn: () => T): T => db.transaction(() => fn()),
  };
}
