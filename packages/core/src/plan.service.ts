// HANDOFF §5 Today's plan, refined by engine.md §4 PlanService: a warm-up (mastered level,
// lowest recent score), one new level (alternating active tracks day to day) and one review
// (the level with the most due steps). Built once per local day and persisted.
import { type Level, type Step, stepNoun } from '@cadence/content';
import { keySignatureText } from '@cadence/music';
import { type ServiceContext, joinAnd, timezoneOf } from './context';
import { localDay, localHour } from './dates';
import type { CtaDto, PlanBlockDto, ResumeDto, TodayDto } from './dto';
import type {
  NewPlanBlock,
  PlanBlockRow,
  PlanBlockType,
  PlanWithBlocks,
  StepProgressRow,
} from './ports';
import type { ProgressService } from './progress.service';
import { type Rng, createRng, hashString } from './questions';
import { type ReviewService, stepShort } from './review.service';
import type { SettingsService } from './settings.service';

export const ESTIMATE_MIN = { warmup: 2, review: 2, learnChord: 5, learnEar: 3 } as const;

export const ALL_DONE_CTA = {
  label: "That's today — explore the tracks",
  route: '/tracks',
  subtitle: 'Come back tomorrow to keep the streak.',
} as const;

export interface PlanService {
  /** The persisted plan for today with live block statuses, else build and persist one. */
  getToday(): TodayDto;
  /** The raw persisted plan for today (building it if needed). */
  todayPlan(): PlanWithBlocks | null;
}

interface Deps {
  progress: ProgressService;
  review: ReviewService;
  settings: SettingsService;
}

export function createPlanService(ctx: ServiceContext, deps: Deps): PlanService {
  const { repos, content, clock } = ctx;
  const { progress, review, settings } = deps;

  // ------------------------------------------------------------------ copy helpers

  /** "C major · all 7 diatonic chords" · "A minor · scale, up and down" · "Intervals · Level 3". */
  const blockTitle = (levelId: string): string => {
    const ref = content.requireLevel(levelId);
    if (ref.isEar) return content.shortTitle(levelId);
    const steps = ref.level.steps;
    const n = steps.length;
    if (steps.every((s) => s.match.type === 'chord')) {
      return `${ref.level.title} · all ${n} diatonic chords`;
    }
    if (stepNoun(steps) === 'scale') {
      return `${ref.level.title} · scale, ${joinAnd(steps.map((s) => s.label.toLowerCase()))}`;
    }
    if (stepNoun(steps) === 'progression') return `${ref.level.title} · ${n} progressions`;
    return `${ref.level.title} · ${n} steps`;
  };

  const warmupBlurb = (levelId: string): string => {
    const last = progress.lastFinishedSession(levelId);
    if (!last) return 'You know this one. Played clean, no hints.';
    const ref = content.requireLevel(levelId);
    if (ref.isEar) {
      const correct = last.correct ?? 0;
      return correct >= last.stepsTotal
        ? 'You know this one. Played clean, no hints.'
        : `Last time: ${correct} of ${last.stepsTotal} right.`;
    }
    return last.stepsClean >= last.stepsTotal
      ? 'You know this one. Played clean, no hints.'
      : `Last time: ${last.stepsClean} of ${last.stepsTotal} clean.`;
  };

  const learnBlurb = (level: Level, trackId: string): string => {
    const ref = content.requireLevel(level.id);
    if (ref.isEar) return [ref.stage?.blurb, level.blurb].filter(Boolean).join(' ');
    if (!level.key) return level.blurb ?? '';
    const lead =
      progress.completedCount(trackId) === 0
        ? 'Your first key. '
        : 'Next stop on the circle of fifths. ';
    return `${lead}${keySignatureText(level.key)}`;
  };

  const reviewBlurb = (levelId: string, due: readonly StepProgressRow[]): string => {
    const ref = content.requireLevel(levelId);
    const steps = content.stepsOf(ref.level);
    const order = new Map(steps.map((s, i) => [s.id, i]));
    const byId = new Map(steps.map((s): [string, Step] => [s.id, s]));
    const rows = [...due].sort((a, b) => (order.get(a.stepId) ?? 0) - (order.get(b.stepId) ?? 0));
    const label = (r: StepProgressRow): string => {
      const step = byId.get(r.stepId);
      if (!step) return r.stepId;
      return ref.isEar ? stepShort(step) : step.label;
    };
    const labels = rows.map(label);
    const [only] = rows;
    if (rows.length === 1 && only) {
      const l = labels[0] ?? '';
      switch (only.lastResult) {
        case 'hinted':
          return `You needed a hint on ${l} last time. Let's lock it in.`;
        case 'skipped':
          return `You skipped ${l} last time. Let's lock it in.`;
        case 'wrong':
          return `You missed ${l} last time. Let's lock it in.`;
        case 'marked':
          return `You marked ${l} as played last time. Let's lock it in.`;
        case 'clean':
        case null:
          return `${l} is due. Quick pass.`;
      }
    }
    if (labels.length <= 3) return `${joinAnd(labels)} are due. Quick pass.`;
    return `${labels[0] ?? ''}, ${labels[1] ?? ''} and ${labels.length - 2} more are due. Quick pass.`;
  };

  // ------------------------------------------------------------------ build

  const build = (today: string): PlanWithBlocks => {
    const now = clock.now();
    const rows = new Map(repos.trackSettings.list().map((r) => [r.trackId, r]));
    // 1. active tracks = enrolled ∧ available (∧ not paused).
    const active = content.tracks().filter((t) => t.available && rows.get(t.id)?.active === true);
    const activeIds = new Set(active.map((t) => t.id));

    // 2. Learn: smallest last_new_level_at (null first; ties by content order).
    const learn =
      active
        .map((t) => ({
          track: t,
          level: progress.currentLevel(t.id),
          last: rows.get(t.id)?.lastNewLevelAt ?? null,
        }))
        .filter((c): c is typeof c & { level: Level } => c.level !== null)
        .sort(
          (a, b) =>
            (a.last ?? Number.NEGATIVE_INFINITY) - (b.last ?? Number.NEGATIVE_INFINITY) ||
            content.trackIndex(a.track.id) - content.trackIndex(b.track.id),
        )[0] ?? null;

    // 3. Review: most due steps, excluding the learn level (tie: earliest due, content order).
    const position = (levelId: string): number => {
      const ref = content.level(levelId);
      return ref ? content.trackIndex(ref.track.id) * 10_000 + ref.order : Number.MAX_SAFE_INTEGER;
    };
    const reviewPick =
      review
        .dueCountByLevel(today)
        .filter(
          (d) =>
            activeIds.has(d.trackId) &&
            d.levelId !== learn?.level.id &&
            content.level(d.levelId) !== null,
        )
        .sort(
          (a, b) =>
            b.count - a.count ||
            a.earliestDueOn.localeCompare(b.earliestDueOn) ||
            position(a.levelId) - position(b.levelId),
        )[0] ?? null;

    // 4. Warm-up: mastered level with the lowest last score (tie: oldest last completion).
    const mastered = repos.levelProgress
      .listMastered()
      .filter((lp) => activeIds.has(lp.trackId) && content.level(lp.levelId) !== null);
    const warm =
      mastered
        .filter((lp) => lp.levelId !== learn?.level.id && lp.levelId !== reviewPick?.levelId)
        .sort(
          (a, b) =>
            a.lastScore - b.lastScore ||
            (a.lastCompletedAt ?? 0) - (b.lastCompletedAt ?? 0) ||
            position(a.levelId) - position(b.levelId),
        )[0] ?? null;

    const blocks: NewPlanBlock[] = [];
    const push = (
      type: PlanBlockType,
      levelId: string,
      blurb: string,
      estimateMin: number,
      lessonFirst = false,
    ): void => {
      const ref = content.requireLevel(levelId);
      blocks.push({
        day: today,
        slot: blocks.length,
        type,
        trackId: ref.track.id,
        levelId,
        title: blockTitle(levelId),
        blurb,
        estimateMin,
        status: 'pending',
        sessionId: null,
        completedAt: null,
        lessonFirst,
      });
    };

    if (!learn && !reviewPick) {
      // 7. Nothing to do → one "Free play" warm-up of a random mastered level.
      const rng: Rng = createRng(hashString(`free:${today}`));
      const pick = mastered[Math.floor(rng() * mastered.length)];
      if (pick) {
        push(
          'warmup',
          pick.levelId,
          'Nothing new or due today. Play one you know.',
          ESTIMATE_MIN.warmup,
        );
      }
    } else {
      if (warm) push('warmup', warm.levelId, warmupBlurb(warm.levelId), ESTIMATE_MIN.warmup);
      if (learn) {
        const ref = content.requireLevel(learn.level.id);
        const lessonFirst =
          learn.track.lesson !== undefined && rows.get(learn.track.id)?.lessonSeenAt == null;
        push(
          'learn',
          learn.level.id,
          learnBlurb(learn.level, learn.track.id),
          ref.isEar ? ESTIMATE_MIN.learnEar : ESTIMATE_MIN.learnChord,
          lessonFirst,
        );
      }
      if (reviewPick) {
        const due = review.dueSteps(today).filter((r) => r.levelId === reviewPick.levelId);
        push(
          'review',
          reviewPick.levelId,
          reviewBlurb(reviewPick.levelId, due),
          ESTIMATE_MIN.review,
        );
      }
    }

    return repos.plans.save(
      { day: today, generatedAt: now, learnTrackId: learn?.track.id ?? null },
      blocks,
    );
  };

  const todayPlan = (): PlanWithBlocks | null => {
    if (!repos.profile.get()) return null;
    const today = clock.today(timezoneOf(ctx));
    return repos.transaction(() => repos.plans.get(today) ?? build(today));
  };

  // ------------------------------------------------------------------ DTO

  const toBlockDto = (
    block: PlanBlockRow,
    upNext: boolean,
    freePlay: boolean,
  ): PlanBlockDto | null => {
    const ref = content.level(block.levelId);
    if (!ref) return null; // content changed under a persisted plan
    const lessonDue =
      block.lessonFirst &&
      ref.track.lesson !== undefined &&
      settings.trackSettings(block.trackId)?.lessonSeenAt == null;
    const eyebrow =
      block.type === 'warmup'
        ? freePlay
          ? 'Free play'
          : 'Warm-up'
        : block.type === 'learn'
          ? ref.isEar
            ? 'Learn · new level'
            : 'Learn · new key'
          : 'Review · due today';
    const state =
      block.status === 'done'
        ? ' · done'
        : block.status === 'in_progress'
          ? ' · in progress'
          : upNext
            ? ' · up next'
            : '';
    return {
      id: block.id,
      slot: block.slot,
      type: block.type,
      kind: freePlay ? 'free' : block.type,
      trackId: block.trackId,
      levelId: block.levelId,
      eyebrow,
      title: block.title,
      shortTitle: content.shortTitle(block.levelId),
      blurb: block.blurb,
      estimateMin: block.estimateMin,
      status: block.status,
      meta: `${block.estimateMin} min${state}`,
      sessionId: block.sessionId,
      lessonFirst: block.lessonFirst,
      route: lessonDue ? `/tracks/${block.trackId}/lesson` : progress.routeFor(block.levelId),
      isEar: ref.isEar,
    };
  };

  /**
   * Task 16: today's latest unfinished session with at least one recorded step. Leaving
   * Practice or an ear drill mid-level never abandons the session, so Today offers it back.
   */
  const resumable = (today: string): ResumeDto | null => {
    const tz = timezoneOf(ctx);
    const now = clock.now();
    // A local day is at most 26 h long; narrow a 2-day window down to today's local date.
    const candidates = repos.sessions
      .listStartedBetween(now - 2 * 86_400_000, now + 1)
      .filter((s) => s.finishedAt === null && localDay(s.startedAt, tz) === today)
      .reverse();
    for (const s of candidates) {
      const ref = content.level(s.levelId);
      if (!ref) continue;
      const done = new Set(repos.sessions.listSteps(s.id).map((r) => r.ordinal)).size;
      if (done === 0) continue;
      return {
        sessionId: s.id,
        levelId: s.levelId,
        trackId: s.trackId,
        title: content.shortTitle(s.levelId),
        isEar: ref.isEar,
        stepNoun: stepNoun(ref.level.steps),
        done,
        total: ref.isEar ? (s.questionOrder?.length ?? done) : ref.level.steps.length,
      };
    }
    return null;
  };

  const greetingFor = (name: string): string => {
    const hour = localHour(clock.now(), timezoneOf(ctx));
    const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    return name ? `Good ${part}, ${name}.` : `Good ${part}.`;
  };

  const getToday = (): TodayDto => {
    const profile = repos.profile.get();
    const tracks = content.tracks().map((t) => progress.trackCard(t.id));
    const today = clock.today(timezoneOf(ctx));
    const saved = todayPlan();

    const rawBlocks = saved?.blocks ?? [];
    const freePlay =
      saved !== null &&
      saved.plan.learnTrackId === null &&
      rawBlocks.length > 0 &&
      rawBlocks.every((b) => b.type === 'warmup');
    const firstOpen = rawBlocks.find((b) => b.status !== 'done');
    const blocks = rawBlocks.flatMap((b) => {
      const dto = toBlockDto(b, b.id === firstOpen?.id, freePlay);
      return dto ? [dto] : [];
    });

    const estimateMin = blocks.reduce((n, b) => n + b.estimateMin, 0);
    const about = Math.max(5, Math.round(estimateMin / 5) * 5);
    const allDone = blocks.length > 0 && blocks.every((b) => b.status === 'done');
    const next = blocks.find((b) => b.status !== 'done');

    let cta: CtaDto;
    if (next) {
      cta = {
        label:
          next.status === 'in_progress'
            ? `Continue with ${next.shortTitle}`
            : `Start ${next.shortTitle}`,
        route: next.route,
        subtitle: null,
        blockId: next.id,
        levelId: next.levelId,
        kind: next.kind,
        lessonFirst: next.route.endsWith('/lesson'),
      };
    } else {
      cta = {
        label: allDone ? ALL_DONE_CTA.label : 'Explore the tracks',
        route: ALL_DONE_CTA.route,
        subtitle: allDone ? ALL_DONE_CTA.subtitle : null,
        blockId: null,
        levelId: null,
        kind: null,
        lessonFirst: false,
      };
    }

    return {
      day: today,
      greeting: greetingFor(profile?.name ?? ''),
      subtitle:
        blocks.length === 0
          ? 'Nothing due today. Pick something from your tracks.'
          : `About ${about} minutes today. No tempo, no rush — just play each chord cleanly.`,
      summary: `${blocks.length} block${blocks.length === 1 ? '' : 's'} · ~${about} min`,
      estimateMin,
      blocks,
      cta,
      allDone,
      tracks,
      resume: profile ? resumable(today) : null,
    };
  };

  return { getToday, todayPlan };
}
