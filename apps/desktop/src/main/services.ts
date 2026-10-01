import type { Track } from '@cadence/content';
import { type Services, SystemClock, createServices } from '@cadence/core';
import { type OpenedDatabase, createRepos } from '@cadence/db';

export interface AppServices {
  services: Services;
  /** Concrete so dev.seed can persist its offset after `advance-day`. */
  clock: SystemClock;
}

/**
 * Composition root (architecture.md §4 step 5): repos over the open DB + the generated content +
 * the wall clock → the engine's plain service object. No DI container.
 */
export function composeServices(
  database: OpenedDatabase,
  content: readonly Track[],
  clockOffsetMs = 0,
): AppServices {
  const clock = new SystemClock(clockOffsetMs);
  const services = createServices({ repos: createRepos(database.db), content, clock });
  return { services, clock };
}
