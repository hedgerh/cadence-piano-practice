// Composition: createServices({ repos, content, clock }) → a plain object of services.
// Main (Task 05) maps IPC channels onto these; tests use in-memory repos + FakeClock.
import type { Track } from '@cadence/content';
import { type ContentService, createContentService } from './content.service';
import type { ServiceContext } from './context';
import { type PlanService, createPlanService } from './plan.service';
import type { Clock, Repos } from './ports';
import { type ProgressService, createProgressService } from './progress.service';
import { type ReviewService, createReviewService } from './review.service';
import { type SettingsService, createSettingsService } from './settings.service';
import { type StreakService, createStreakService } from './streak.service';
import { type XpService, createXpService } from './xp.service';

export interface CreateServicesInput {
  repos: Repos;
  /** The generated tracks (`buildTracks()`), or an already-built ContentService. */
  content: readonly Track[] | ContentService;
  clock: Clock;
}

export interface Services {
  repos: Repos;
  clock: Clock;
  content: ContentService;
  review: ReviewService;
  xp: XpService;
  streak: StreakService;
  settings: SettingsService;
  progress: ProgressService;
  plan: PlanService;
}

function isContentService(c: CreateServicesInput['content']): c is ContentService {
  return !Array.isArray(c);
}

export function createServices({ repos, content, clock }: CreateServicesInput): Services {
  const contentService = isContentService(content) ? content : createContentService(content);
  const ctx: ServiceContext = { repos, content: contentService, clock };
  const review = createReviewService(ctx);
  const xp = createXpService(ctx);
  const streak = createStreakService(ctx);
  const settings = createSettingsService(ctx, streak);
  const progress = createProgressService(ctx, { review, xp, streak, settings });
  const plan = createPlanService(ctx, { progress, review, settings });
  return { repos, clock, content: contentService, review, xp, streak, settings, progress, plan };
}
