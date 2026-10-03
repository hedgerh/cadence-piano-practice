// engine.md §4 ProgressService (sessions, level progress, nextLevel, trackOverview) and the
// ear question hand-off (questions.ts). HANDOFF §5 for XP, review and streak side effects.
import { type Level, type Stage, type Track, stepKey } from '@cadence/content';
import { pretty } from '@cadence/music';
import type { LevelRef } from './content.service';
import { type ServiceContext, numberWord, timezoneOf, todayOf } from './context';
import { localDay } from './dates';
import type {
  CircleNodeDto,
  CompleteChipDto,
  CompleteDto,
  FinishSessionInput,
  LadderLevelDto,
  RecordPlaybackInput,
  RecordPlaybackResult,
  RecordStepInput,
  RecordStepResult,
  SessionDto,
  SessionQuestionDto,
  StageDto,
  TrackCardDto,
  TrackCardStatus,
  TrackOverviewDto,
  UpNextDto,
} from './dto';
import type {
  LevelProgressRow,
  PlanBlockRow,
  SessionFocus,
  SessionKind,
  SessionRow,
  SessionRun,
  SessionStepRow,
} from './ports';
import { createRng, focusPool, hashString, selectQuestions } from './questions';
import { type ReviewService, stepShort } from './review.service';
import type { SettingsService } from './settings.service';
import type { StreakService } from './streak.service';
import { LEVEL_XP, PLAYBACK_XP, type XpService, stepXp } from './xp.service';

export interface ProgressService {
  isCompleted(levelId: string): boolean;
  completedCount(trackId: string): number;
  isStageUnlocked(trackId: string, stageId: string): boolean;
  isLevelUnlocked(levelId: string): boolean;
  /** The track's next new level: first uncompleted level (ladders: in unlocked stages). */
  currentLevel(trackId: string): Level | null;
  /** engine.md §4 nextLevel: circle → next uncompleted clockwise; ladder → same stage, then next unlocked stage. */
  nextLevel(trackId: string, levelId: string): Level | null;
  /** The last finished session of a level, if any. */
  lastFinishedSession(levelId: string): SessionRow | null;
  routeFor(levelId: string): string;
  trackOverview(trackId: string): TrackOverviewDto;
  trackCard(trackId: string): TrackCardDto;
  /**
   * `focus: 'misses'` starts a focus round (engine.md §4): no plan block, no completion.
   * `run: 'circle'` starts a circle-run session (decisions.md 2026-10-03): the kind is chosen
   * here (`review` for a completed key, else `learn`) and Complete's next ignores completion.
   */
  startLevel(
    levelId: string,
    kind: SessionKind,
    planBlockId?: string,
    focus?: SessionFocus,
    run?: SessionRun,
  ): SessionDto;
  getSession(sessionId: string): SessionDto;
  recordStep(input: RecordStepInput): RecordStepResult;
  recordPlayback(input: RecordPlaybackInput): RecordPlaybackResult;
  finishSession(input: FinishSessionInput): CompleteDto;
}

interface Deps {
  review: ReviewService;
  xp: XpService;
  streak: StreakService;
  settings: SettingsService;
}

interface TrackState {
  track: Track;
  order: Level[];
  completed: Set<string>;
  progress: Map<string, LevelProgressRow>;
}

const emptyLevelProgress = (levelId: string, trackId: string, now: number): LevelProgressRow => ({
  levelId,
  trackId,
  status: 'available',
  attempts: 0,
  firstCompletedAt: null,
  lastCompletedAt: null,
  lastScore: 0,
  bestScore: 0,
  bestTimeMs: null,
  mastered: false,
  masteredAt: null,
  updatedAt: now,
});

/** Circle node label: "A" / "F♯" for major keys, "Am" for minor keys. */
function circleLabel(level: Level): string {
  if (!level.key) return level.title;
  return level.key.mode === 'major' ? pretty(level.key.tonic) : `${pretty(level.key.tonic)}m`;
}

export function createProgressService(ctx: ServiceContext, deps: Deps): ProgressService {
  const { repos, content, clock } = ctx;
  const { review, xp, streak, settings } = deps;

  // ------------------------------------------------------------------ level state

  const trackState = (trackId: string): TrackState => {
    const track = content.requireTrack(trackId);
    const progress = new Map(repos.levelProgress.listByTrack(trackId).map((r) => [r.levelId, r]));
    const completed = new Set(
      [...progress.values()].filter((r) => r.status === 'completed').map((r) => r.levelId),
    );
    return { track, order: content.levelOrder(trackId), completed, progress };
  };

  const findStage = (track: Track, stageId: string): Stage | null =>
    track.stages?.find((s) => s.id === stageId) ?? null;

  /** engine.md §4 isUnlocked(stage) = no unlock, or passed levels in the target stage ≥ N − 1. */
  const stageUnlocked = (st: TrackState, stage: Stage): boolean => {
    if (!stage.unlock) return true;
    const target = findStage(st.track, stage.unlock.stage);
    if (!target) return false;
    const passed = target.levels.filter((l) => st.completed.has(l.id)).length;
    return passed >= stage.unlock.level - 1;
  };

  const stageComplete = (st: TrackState, stage: Stage): boolean =>
    stage.levels.length > 0 && stage.levels.every((l) => st.completed.has(l.id));

  /**
   * engine.md §6.9 unlock copy, generated from the Unlock `{stage S, level N}` so that it
   * reproduces EarPath.dc.html: while S itself is open the learner is climbing it, so the copy
   * points at the level they will reach ("Unlocks at Intervals L4"); when S is still locked
   * (or N is past S's last level) it names the level to pass ("Unlocks after Scale degrees L3").
   */
  const unlockText = (st: TrackState, stage: Stage): string | null => {
    if (!stage.unlock || stageUnlocked(st, stage)) return null;
    const source = findStage(st.track, stage.unlock.stage);
    if (!source) return null;
    const n = stage.unlock.level;
    const sourceOpen = stageUnlocked(st, source) && !stageComplete(st, source);
    if (n <= source.levels.length && sourceOpen) return `Unlocks at ${source.title} L${n}`;
    return `Unlocks after ${source.title} L${n - 1}`;
  };

  const currentIn = (st: TrackState): Level | null => {
    if (st.track.stages) {
      for (const stage of st.track.stages) {
        if (!stageUnlocked(st, stage)) continue;
        const level = stage.levels.find((l) => !st.completed.has(l.id));
        if (level) return level;
      }
      return null;
    }
    return st.order.find((l) => !st.completed.has(l.id)) ?? null;
  };

  const nextIn = (st: TrackState, levelId: string): Level | null => {
    const ref = content.requireLevel(levelId);
    if (!st.track.stages || !ref.stage) {
      const n = st.order.length;
      for (let k = 1; k <= n; k++) {
        const level = st.order[(ref.order + k) % n];
        if (level && !st.completed.has(level.id)) return level;
      }
      return null;
    }
    const sameStage = ref.stage.levels
      .slice(ref.indexInStage + 1)
      .find((l) => !st.completed.has(l.id));
    if (sameStage) return sameStage;
    for (const stage of st.track.stages.slice(ref.stageIndex + 1)) {
      if (!stageUnlocked(st, stage)) continue;
      const level = stage.levels.find((l) => !st.completed.has(l.id));
      if (level) return level;
    }
    return currentIn(st);
  };

  const routeFor = (levelId: string): string => {
    const ref = content.requireLevel(levelId);
    return ref.isEar ? `/ear/${levelId}` : `/practice/${levelId}`;
  };

  const unitOf = (track: Track): string => (track.map === 'circle-of-fifths' ? 'keys' : 'levels');

  const completedTitles = (st: TrackState): string =>
    st.order
      .filter((l) => st.completed.has(l.id))
      .map(circleLabel)
      .join(', ');

  // ------------------------------------------------------------------ overview & cards

  const trackOverview = (trackId: string): TrackOverviewDto => {
    const st = trackState(trackId);
    const { track } = st;
    const row = settings.trackSettings(trackId);
    const current = currentIn(st);
    const due = new Map(review.dueCountByLevel().map((d) => [d.levelId, d.count]));
    const done = st.completed.size;
    const total = st.order.length;

    let nodes: CircleNodeDto[] | null = null;
    let stages: StageDto[] | null = null;
    if (track.stages) {
      stages = track.stages.map((stage): StageDto => {
        const unlocked = stageUnlocked(st, stage);
        const complete = stageComplete(st, stage);
        const firstOpen = stage.levels.findIndex((l) => !st.completed.has(l.id));
        const levels = stage.levels.map((l, i): LadderLevelDto => ({
          levelId: l.id,
          title: l.title,
          blurb: l.blurb ?? '',
          number: i + 1,
          state: st.completed.has(l.id)
            ? 'done'
            : !unlocked
              ? 'locked'
              : i === firstOpen
                ? 'current'
                : 'upcoming',
        }));
        return {
          stageId: stage.id,
          title: stage.title,
          blurb: stage.blurb,
          state: complete ? 'complete' : unlocked ? 'open' : 'locked',
          unlockText: unlockText(st, stage),
          progressText: complete
            ? 'Complete'
            : unlocked
              ? `Level ${firstOpen + 1} of ${stage.levels.length}`
              : null,
          levels,
        };
      });
    } else {
      nodes = st.order.map((l): CircleNodeDto => ({
        levelId: l.id,
        title: l.title,
        label: circleLabel(l),
        state: st.completed.has(l.id) ? 'done' : l.id === current?.id ? 'current' : 'upcoming',
        mastered: st.progress.get(l.id)?.mastered ?? false,
        dueCount: due.get(l.id) ?? 0,
      }));
    }

    let upNext: UpNextDto | null = null;
    if (current) {
      const stage = content.stageOf(current.id);
      upNext = {
        levelId: current.id,
        title: current.title,
        stageTitle: stage?.title ?? null,
        blurb: current.blurb ?? '',
        label: `Start ${current.title}`,
        route: routeFor(current.id),
      };
    }

    return {
      trackId,
      title: track.title,
      blurb: track.blurb,
      map: track.map,
      available: track.available,
      enrolled: row !== null,
      active: row?.active ?? false,
      visibility: row?.visibility ?? 'all',
      hasLesson: track.lesson !== undefined,
      lessonSeen: row?.lessonSeenAt != null,
      progress: { done, total, label: `${done} of ${total} ${unitOf(track)}` },
      completedTitles: completedTitles(st),
      nodes,
      stages,
      upNext,
    };
  };

  const STATUS_LABEL: Record<TrackCardStatus, string> = {
    in_progress: 'In progress',
    ready: 'Ready to start',
    not_started: 'Not started',
    complete: 'Complete',
  };

  const trackCard = (trackId: string): TrackCardDto => {
    const st = trackState(trackId);
    const { track } = st;
    const row = settings.trackSettings(trackId);
    const done = st.completed.size;
    const total = st.order.length;
    const started = [...st.progress.values()].some((r) => r.status !== 'available');
    const status: TrackCardStatus =
      total > 0 && done === total
        ? 'complete'
        : done > 0 || started
          ? 'in_progress'
          : track.available
            ? 'ready'
            : 'not_started';
    const current = currentIn(st);
    const isCircle = track.map === 'circle-of-fifths';
    const titles = completedTitles(st);
    const progressText = `${done} of ${total} ${unitOf(track)}${isCircle && titles ? ` · ${titles}` : ''}`;
    let nextText: string | null = null;
    if (track.available && track.lesson && row?.lessonSeenAt == null && done === 0) {
      nextText = 'Starts with a 1-min lesson';
    } else if (track.available && isCircle && current) {
      nextText = `Next: ${current.key?.mode === 'major' ? circleLabel(current) : current.title}`;
    }
    return {
      trackId,
      title: track.title,
      map: track.map,
      available: track.available,
      enrolled: row !== null,
      active: row?.active ?? false,
      status,
      statusLabel: STATUS_LABEL[status],
      done,
      total,
      progressText,
      nextText,
      currentLabel: current ? content.shortTitle(current.id) : null,
      currentLevelId: current?.id ?? null,
    };
  };

  // ------------------------------------------------------------------ sessions

  const requireProfileTz = (): string => {
    if (!repos.profile.get()) throw new Error('No profile: complete onboarding first');
    return timezoneOf(ctx);
  };

  const requireSession = (sessionId: string): SessionRow => {
    const s = repos.sessions.get(sessionId);
    if (!s) throw new Error(`Unknown session "${sessionId}"`);
    return s;
  };

  const toSessionDto = (session: SessionRow, resumed: boolean): SessionDto => {
    const ref = content.requireLevel(session.levelId);
    const rows = repos.sessions.listSteps(session.id);
    const progress = new Map(
      repos.stepProgress.listByLevel(session.levelId).map((r) => [r.stepId, r]),
    );
    const questions: SessionQuestionDto[] = [];
    (session.questionOrder ?? []).forEach((stepId, ordinal) => {
      const step = content.step(session.levelId, stepId);
      if (step) questions.push({ ...step, ordinal });
    });
    return {
      sessionId: session.id,
      trackId: session.trackId,
      trackTitle: ref.track.title,
      levelId: session.levelId,
      levelTitle: ref.level.title,
      shortTitle: content.shortTitle(session.levelId),
      stageTitle: ref.stage?.title ?? null,
      kind: session.kind,
      isEar: ref.isEar,
      planBlockId: session.planBlockId,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      resumed,
      visibility: settings.visibility(session.trackId),
      pass: ref.isEar ? content.passOf(ref.level) : null,
      steps: ref.isEar
        ? []
        : ref.level.steps.map((s) => {
            const p = progress.get(s.id);
            return {
              ...s,
              lastResult: p?.lastResult ?? null,
              dueOn: p?.dueOn ?? null,
              intervalDays: p?.intervalDays ?? 0,
            };
          }),
      questions,
      results: rows.map((r) => ({
        ordinal: r.ordinal,
        stepId: r.stepId,
        result: r.result,
        hintLevel: r.hintLevel,
        chosen: r.chosen,
        tries: r.tries,
        playedBack: r.playedBack,
        elapsedMs: r.elapsedMs,
      })),
      focus: session.focus,
      run: session.run,
    };
  };

  /** Today's not-done plan block for a level (engine.md §4: "else any pending block today"). */
  const openBlockFor = (levelId: string, today: string): PlanBlockRow | null =>
    repos.plans.get(today)?.blocks.find((b) => b.levelId === levelId && b.status !== 'done') ??
    null;

  const startLevel = (
    levelId: string,
    requestedKind: SessionKind,
    planBlockId?: string,
    focus?: SessionFocus,
    run?: SessionRun,
  ): SessionDto => {
    const ref = content.requireLevel(levelId);
    // engine.md §4 focus rounds are ear-only; a chord level ignores the flag.
    const focusMode: SessionFocus | null = focus !== undefined && ref.isEar ? focus : null;
    // decisions.md 2026-10-03 circle run: circle tracks only, never a focus round.
    const runMode: SessionRun | null =
      run !== undefined && ref.track.map === 'circle-of-fifths' && focusMode === null ? run : null;
    const kind: SessionKind =
      runMode === null
        ? requestedKind
        : repos.levelProgress.get(levelId)?.status === 'completed'
          ? 'review'
          : 'learn';
    const tz = requireProfileTz();
    const now = clock.now();
    const today = clock.today(tz);

    return repos.transaction(() => {
      let block: PlanBlockRow | null = null;
      if (focusMode !== null) {
        // A focus round never claims or completes a plan block.
      } else if (planBlockId !== undefined) {
        block = repos.plans.getBlock(planBlockId);
        if (!block) throw new Error(`Unknown plan block "${planBlockId}"`);
        if (block.levelId !== levelId) {
          throw new Error(`Plan block "${planBlockId}" is for ${block.levelId}, not ${levelId}`);
        }
      } else {
        block = openBlockFor(levelId, today);
      }
      const claim = (sessionId: string): void => {
        if (block && block.status !== 'done') {
          repos.plans.updateBlock(block.id, { status: 'in_progress', sessionId });
        }
      };

      // Resume an unfinished session for this level from today instead of starting another.
      const open = repos.sessions
        .listByLevel(levelId)
        .filter(
          (s) =>
            s.finishedAt === null && localDay(s.startedAt, tz) === today && s.focus === focusMode,
        );
      let resumed = open[open.length - 1];
      if (resumed) {
        if (block && resumed.planBlockId === null) {
          resumed = repos.sessions.update(resumed.id, { planBlockId: block.id }) ?? resumed;
        }
        // A resumed session joins (or leaves) the circle run the learner just asked for.
        if (resumed.run !== runMode) {
          const patch = runMode === null ? { run: null } : { run: runMode, kind };
          resumed = repos.sessions.update(resumed.id, patch) ?? resumed;
        }
        claim(resumed.id);
        return toSessionDto(resumed, true);
      }

      const st = trackState(ref.track.id);
      const isNextNew = currentIn(st)?.id === levelId;

      let questionOrder: string[] | null = null;
      if (ref.isEar) {
        const rng = createRng(hashString(`${levelId}:${now}`));
        const progressRows = repos.stepProgress.listByLevel(levelId);
        const pool = ref.level.pool ?? [];
        questionOrder = selectQuestions(
          focusMode === 'misses' ? focusPool(pool, progressRows, ref.level.activeOptions) : pool,
          progressRows,
          today,
          content.passOf(ref.level).of,
          rng,
        ).map((s) => s.id);
      }

      const session = repos.sessions.create({
        trackId: ref.track.id,
        levelId,
        kind,
        planBlockId: block?.id ?? null,
        startedAt: now,
        questionOrder,
        focus: focusMode,
        run: runMode,
      });
      claim(session.id);

      const lp = st.progress.get(levelId);
      if (!lp || lp.status !== 'completed') {
        repos.levelProgress.upsert({
          ...(lp ?? emptyLevelProgress(levelId, ref.track.id, now)),
          status: 'in_progress',
          updatedAt: now,
        });
      }

      if (kind === 'learn' && isNextNew && repos.trackSettings.get(ref.track.id)) {
        repos.trackSettings.update(ref.track.id, { lastNewLevelAt: now });
      }

      return toSessionDto(session, false);
    });
  };

  const recordStep = (input: RecordStepInput): RecordStepResult => {
    const session = requireSession(input.sessionId);
    if (session.finishedAt !== null) throw new Error(`Session "${session.id}" is finished`);
    const ref = content.requireLevel(session.levelId);
    const step = content.step(session.levelId, input.stepId);
    if (!step) throw new Error(`Unknown step "${input.stepId}" in ${session.levelId}`);
    if (!Number.isInteger(input.ordinal) || input.ordinal < 0) {
      throw new Error(`Invalid ordinal ${input.ordinal}`);
    }
    if (ref.isEar && session.questionOrder?.[input.ordinal] !== input.stepId) {
      throw new Error(`Question ${input.ordinal} of "${session.id}" is not "${input.stepId}"`);
    }
    const now = clock.now();

    return repos.transaction(() => {
      const rows = repos.sessions.listSteps(session.id);
      const existing = rows.find((r) => r.ordinal === input.ordinal);
      const repeatInSession = rows.some(
        (r) => r.stepId === input.stepId && r.ordinal !== input.ordinal,
      );
      repos.sessions.upsertStep({
        sessionId: session.id,
        levelId: session.levelId,
        stepId: input.stepId,
        ordinal: input.ordinal,
        result: input.result,
        hintLevel: input.hintLevel,
        tries: input.tries ?? null,
        chosen: input.chosen ?? null,
        elapsedMs: input.elapsedMs ?? null,
        createdAt: existing?.createdAt ?? now,
      });

      // Idempotent on (sessionId, ordinal): a retry neither reschedules nor double-awards.
      const progress = existing
        ? repos.stepProgress.get(session.levelId, input.stepId)
        : review.record({
            trackId: session.trackId,
            levelId: session.levelId,
            stepId: input.stepId,
            result: input.result,
            repeatInSession,
          });

      const delta = stepXp(input.result) - (existing ? stepXp(existing.result) : 0);
      let total = xp.total();
      if (delta !== 0) {
        total = xp.award(delta, 'step', {
          sessionId: session.id,
          stepId: stepKey(session.levelId, input.stepId),
        }).newTotal;
        repos.sessions.update(session.id, { xpSteps: session.xpSteps + delta });
      }
      return {
        xpAwarded: delta,
        xpTotal: total,
        dueOn: progress?.dueOn ?? null,
        intervalDays: progress?.intervalDays ?? 0,
      };
    });
  };

  const recordPlayback = ({ sessionId, ordinal }: RecordPlaybackInput): RecordPlaybackResult => {
    const session = requireSession(sessionId);
    const ref = content.requireLevel(session.levelId);
    if (!ref.isEar || session.finishedAt !== null) return { xpAwarded: 0, xpTotal: xp.total() };
    return repos.transaction(() => {
      if (!repos.sessions.markPlayedBack(sessionId, ordinal)) {
        return { xpAwarded: 0, xpTotal: xp.total() };
      }
      const stepId = session.questionOrder?.[ordinal];
      const { newTotal } = xp.award(PLAYBACK_XP, 'playback', {
        sessionId,
        stepId: stepId ? stepKey(session.levelId, stepId) : null,
      });
      repos.sessions.update(sessionId, { xpPlayback: session.xpPlayback + PLAYBACK_XP });
      return { xpAwarded: PLAYBACK_XP, xpTotal: newTotal };
    });
  };

  /** Chord levels: the final result per level step (latest ordinal wins). */
  const finalByStep = (rows: readonly SessionStepRow[]): Map<string, SessionStepRow> => {
    const out = new Map<string, SessionStepRow>();
    for (const r of rows) out.set(r.stepId, r);
    return out;
  };

  const buildComplete = (session: SessionRow, ref: LevelRef): CompleteDto => {
    const rows = repos.sessions.listSteps(session.id);
    const st = trackState(ref.track.id);
    const lp = st.progress.get(ref.level.id);
    const success = session.passed === true;
    const pass = ref.isEar ? content.passOf(ref.level) : null;

    let chips: CompleteChipDto[];
    if (ref.isEar) {
      chips = rows.flatMap((r) => {
        const step = content.step(ref.level.id, r.stepId);
        return step
          ? [
              {
                ordinal: r.ordinal,
                stepId: r.stepId,
                label: step.label,
                short: stepShort(step),
                quality: step.quality ?? null,
                result: r.result,
              },
            ]
          : [];
      });
    } else {
      const finals = finalByStep(rows);
      chips = ref.level.steps.flatMap((step) => {
        const r = finals.get(step.id);
        return r
          ? [
              {
                ordinal: r.ordinal,
                stepId: step.id,
                label: step.label,
                short: stepShort(step),
                quality: step.quality ?? null,
                result: r.result,
              },
            ]
          : [];
      });
    }

    const noteResults = chips.map((c) => ({ stepId: c.stepId, result: c.result }));
    const intervals = [...new Set(noteResults.map((r) => r.stepId))].map(
      (id) => repos.stepProgress.get(ref.level.id, id)?.intervalDays ?? 1,
    );
    const reviewNote = review.reviewNote(
      ref.level,
      noteResults,
      intervals.length > 0 ? Math.min(...intervals) : 1,
    );

    const breakdown = xp.sessionBreakdown(session.id);
    // decisions.md 2026-10-03 circle run: the next key clockwise regardless of completion,
    // ending after the last key in circle order (F major / D minor).
    const run = session.run;
    const next = run === 'circle' ? (st.order[ref.order + 1] ?? null) : nextIn(st, ref.level.id);
    const sameStage = next !== null && content.stageOf(next.id) === ref.stage;
    const nextShort = next ? (sameStage ? next.title : content.shortTitle(next.id)) : null;
    const done = st.completed.size;
    const total = session.stepsTotal;
    const shortTitle = content.shortTitle(ref.level.id);
    const correct = session.correct ?? 0;

    let title: string;
    let subtitle: string;
    if (ref.isEar && session.focus !== null) {
      title = 'Focus round';
      subtitle = `${correct} of ${total} right.`;
    } else if (ref.isEar) {
      title = success ? `${shortTitle}, passed` : `Not yet — ${correct} of ${total}`;
      subtitle = `${correct} of ${total} correct.`;
    } else if (success) {
      title = `${ref.level.title}, complete`;
      const what =
        ref.track.map === 'circle-of-fifths'
          ? `All ${numberWord(total)} diatonic chords.`
          : `All ${numberWord(total)} steps.`;
      const where =
        ref.track.map === 'circle-of-fifths'
          ? done === 1
            ? " That's your first key on the circle."
            : ` That's ${numberWord(done)} keys around the circle.`
          : '';
      subtitle = `${what}${where}`;
    } else {
      title = `${ref.level.title}, not finished`;
      subtitle = `${session.stepsClean} of ${total} clean.`;
    }

    return {
      sessionId: session.id,
      kind: session.kind,
      trackId: ref.track.id,
      levelId: ref.level.id,
      levelTitle: ref.level.title,
      shortTitle,
      isEar: ref.isEar,
      title,
      subtitle,
      completed: success,
      passed: success,
      firstCompletion: success && lp?.firstCompletedAt === session.finishedAt,
      durationMs: session.durationMs ?? 0,
      total,
      cleanCount: session.stepsClean,
      hintedCount: session.stepsHinted,
      skippedCount: session.stepsSkipped,
      markedCount: session.stepsMarked,
      wrongCount: session.stepsWrong,
      correct: ref.isEar ? correct : null,
      pass,
      chips,
      xp: { ...breakdown, newTotal: xp.total() },
      streak: streak.current(),
      track: {
        id: ref.track.id,
        title: ref.track.title,
        done,
        total: st.order.length,
        unit: unitOf(ref.track),
        nextLevelId: next?.id ?? null,
        nextTitle: next?.title ?? null,
      },
      reviewNote,
      next:
        success && next && nextShort
          ? {
              levelId: next.id,
              label: `Keep going — ${nextShort}`,
              route: routeFor(next.id),
              run,
            }
          : null,
      levelStatus: lp?.status ?? 'available',
      focus: session.focus,
      run,
      runPosition: run === null ? null : ref.order + 1,
    };
  };

  const finishSession = ({ sessionId, durationMs, abandoned }: FinishSessionInput): CompleteDto => {
    const session = requireSession(sessionId);
    const ref = content.requireLevel(session.levelId);
    if (session.finishedAt !== null) return buildComplete(session, ref);
    const now = clock.now();
    const today = todayOf(ctx);

    const finished = repos.transaction(() => {
      const rows = repos.sessions.listSteps(session.id);
      const counts = { clean: 0, hinted: 0, skipped: 0, marked: 0, wrong: 0 };
      let total: number;
      let correct: number | null = null;
      let success: boolean;
      let score: number;
      if (ref.isEar) {
        for (const r of rows) counts[r.result]++;
        total = session.questionOrder?.length ?? rows.length;
        correct = counts.clean + counts.hinted;
        const pass = content.passOf(ref.level);
        success = correct >= pass.correct;
        score = Math.round((correct / Math.max(1, pass.of)) * 100);
      } else {
        const finals = finalByStep(rows);
        total = ref.level.steps.length;
        for (const step of ref.level.steps) {
          const r = finals.get(step.id);
          if (r) counts[r.result]++;
        }
        // Chord level complete when every step resolved (clean/hinted/marked/skipped).
        success = ref.level.steps.every((s) => {
          const r = finals.get(s.id)?.result;
          return r !== undefined && r !== 'wrong';
        });
        score = Math.round((counts.clean / Math.max(1, total)) * 100);
      }
      if (abandoned) success = false;
      // engine.md §4 focus rounds: step XP only; never passes, completes or touches the plan.
      const isFocus = session.focus !== null;
      if (isFocus) success = false;

      if (success) xp.award(LEVEL_XP, 'level', { sessionId: session.id });
      const breakdown = xp.sessionBreakdown(session.id);

      const updated = repos.sessions.update(session.id, {
        finishedAt: now,
        durationMs: Math.max(0, Math.round(durationMs)),
        stepsTotal: total,
        stepsClean: counts.clean,
        stepsHinted: counts.hinted,
        stepsSkipped: counts.skipped,
        stepsMarked: counts.marked,
        stepsWrong: counts.wrong,
        correct,
        passed: isFocus ? null : success,
        xpSteps: breakdown.steps,
        xpLevel: breakdown.level,
        xpPlayback: breakdown.playback,
      });
      if (!updated) throw new Error(`Session "${session.id}" vanished`);

      // level_progress: attempts, scores, completion, mastery (engine.md §4).
      const prev =
        repos.levelProgress.get(ref.level.id) ??
        emptyLevelProgress(ref.level.id, ref.track.id, now);
      const mastered = review.mastered(ref.level.id);
      const masteredAt = mastered ? (prev.mastered ? prev.masteredAt : now) : null;
      if (abandoned || isFocus) {
        repos.levelProgress.upsert({ ...prev, mastered, masteredAt, updatedAt: now });
      } else {
        repos.levelProgress.upsert({
          ...prev,
          status: success || prev.status === 'completed' ? 'completed' : 'in_progress',
          attempts: prev.attempts + 1,
          firstCompletedAt: prev.firstCompletedAt ?? (success ? now : null),
          lastCompletedAt: success ? now : prev.lastCompletedAt,
          lastScore: score,
          bestScore: Math.max(prev.bestScore, score),
          bestTimeMs: success
            ? Math.min(prev.bestTimeMs ?? Number.POSITIVE_INFINITY, Math.round(durationMs))
            : prev.bestTimeMs,
          mastered,
          masteredAt,
          updatedAt: now,
        });
      }

      // Plan block: done by id, else any not-done block today for the same level.
      const linked = session.planBlockId ? repos.plans.getBlock(session.planBlockId) : null;
      if (isFocus) {
        // Focus rounds never hold a plan block.
      } else if (success) {
        const block = linked ?? openBlockFor(ref.level.id, today);
        if (block && block.status !== 'done') {
          repos.plans.updateBlock(block.id, {
            status: 'done',
            completedAt: now,
            sessionId: session.id,
          });
        }
      } else if (linked && linked.status === 'in_progress' && linked.sessionId === session.id) {
        repos.plans.updateBlock(linked.id, { status: 'pending' });
      }

      // Day log (streak): any finished level counts (engine.md §4 StreakService).
      if (!abandoned) {
        streak.logCompletion(
          today,
          { blocks: success ? 1 : 0, sessions: 1, xp: breakdown.total },
          now,
        );
      }
      return updated;
    });

    // Streak and next level are computed after the writes above.
    return buildComplete(finished, ref);
  };

  return {
    isCompleted: (levelId) => repos.levelProgress.get(levelId)?.status === 'completed',
    completedCount: (trackId) => trackState(trackId).completed.size,
    isStageUnlocked(trackId, stageId) {
      const st = trackState(trackId);
      const stage = findStage(st.track, stageId);
      return stage !== null && stageUnlocked(st, stage);
    },
    isLevelUnlocked(levelId) {
      const ref = content.requireLevel(levelId);
      return ref.stage === null || stageUnlocked(trackState(ref.track.id), ref.stage);
    },
    currentLevel: (trackId) => currentIn(trackState(trackId)),
    nextLevel: (trackId, levelId) => nextIn(trackState(trackId), levelId),
    lastFinishedSession(levelId) {
      // Focus rounds are a side drill, not an attempt at the level (plan blurbs ignore them).
      const done = repos.sessions
        .listByLevel(levelId)
        .filter((s) => s.finishedAt !== null && s.focus === null);
      return done[done.length - 1] ?? null;
    },
    routeFor,
    trackOverview,
    trackCard,
    startLevel,
    getSession: (sessionId) => toSessionDto(requireSession(sessionId), true),
    recordStep,
    recordPlayback,
    finishSession,
  };
}
