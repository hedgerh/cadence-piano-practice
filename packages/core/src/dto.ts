// Engine outputs. These become the zod output schemas in Task 05 (shared/ipc/contracts.ts);
// field names follow docs/architecture.md §3 (channel table) and docs/engine.md §4.
// Conventions: optional values are `T | null` (zod-friendly under exactOptionalPropertyTypes),
// except `MeDto.midi`, which architecture.md §3 specifies with optional fields.
import type { Pass, Quality, Step, Track } from '@cadence/content';
import type {
  LevelStatus,
  PlanBlockStatus,
  PlanBlockType,
  SessionKind,
  StepResult,
  Visibility,
} from './ports';

// ---------------------------------------------------------------- me.get / me.update

export interface StreakDto {
  days: number;
  /** Today already has a completed level. */
  keptToday: boolean;
  /** Today has no completion yet (engine.md §4 StreakService). */
  atRisk: boolean;
}

export interface MeDto {
  name: string;
  timezone: string;
  xpTotal: number;
  streak: StreakDto;
  midi: { deviceId?: string; deviceName?: string };
  settings: { showMarkPlayedAlways: boolean; autoContinue: boolean };
  /** No profile yet: the renderer shows onboarding. */
  firstRun: boolean;
}

/** `me.update` input: a partial of MeDto. Creates the profile on first run. */
export interface MeUpdate {
  name?: string;
  timezone?: string;
  midi?: { deviceId?: string | null; deviceName?: string | null };
  settings?: { showMarkPlayedAlways?: boolean; autoContinue?: boolean };
}

// ---------------------------------------------------------------- content.tracks

export interface TrackSummaryDto {
  id: string;
  title: string;
  map: Track['map'];
  available: boolean;
}

// ---------------------------------------------------------------- tracks.setSettings

export interface TrackSettingsInput {
  trackId: string;
  visibility?: Visibility;
  active?: boolean;
}

export interface TrackSettingsDto {
  trackId: string;
  visibility: Visibility;
  active: boolean;
  enrolled: boolean;
  lessonSeen: boolean;
}

// ---------------------------------------------------------------- plan.getToday

export interface PlanBlockDto {
  id: string;
  slot: number;
  type: PlanBlockType;
  /** Session kind to start for this block. */
  kind: SessionKind;
  trackId: string;
  levelId: string;
  /** "Warm-up" · "Learn · new key" · "Review · due today" · "Free play". */
  eyebrow: string;
  /** "C major · all 7 diatonic chords" · "Intervals · Level 3". */
  title: string;
  /** "A major" · "Intervals · Level 3" (used in CTA labels). */
  shortTitle: string;
  blurb: string;
  estimateMin: number;
  status: PlanBlockStatus;
  /** "2 min · done" · "5 min · up next" · "2 min". */
  meta: string;
  sessionId: string | null;
  lessonFirst: boolean;
  /** "/practice/a-major" · "/ear/intervals-3" · "/tracks/<id>/lesson" (when the lesson is due). */
  route: string;
  isEar: boolean;
}

export interface CtaDto {
  /** "Start A major" · "Continue with A major" · "That's today — explore the tracks". */
  label: string;
  route: string;
  /** "Come back tomorrow to keep the streak." when everything is done. */
  subtitle: string | null;
  blockId: string | null;
  levelId: string | null;
  kind: SessionKind | null;
  lessonFirst: boolean;
}

export type TrackCardStatus = 'in_progress' | 'ready' | 'not_started' | 'complete';

export interface TrackCardDto {
  trackId: string;
  title: string;
  map: Track['map'];
  available: boolean;
  enrolled: boolean;
  active: boolean;
  status: TrackCardStatus;
  /** "In progress" · "Ready to start" · "Not started" · "Complete". */
  statusLabel: string;
  done: number;
  total: number;
  /** "3 of 12 keys · C, G, D" · "0 of 12 keys" · "2 of 20 levels". */
  progressText: string;
  /** "Next: A" · "Starts with a 1-min lesson" · null. */
  nextText: string | null;
  /** Ladder tracks: "Intervals · Level 3". */
  currentLabel: string | null;
  currentLevelId: string | null;
}

/**
 * Task 16: today's unfinished session the learner walked away from (left Practice or an ear
 * drill mid-level). Leaving never abandons a session, so it stays resumable.
 */
export interface ResumeDto {
  sessionId: string;
  levelId: string;
  trackId: string;
  /** "A major" · "Intervals · Level 3". */
  title: string;
  isEar: boolean;
  /** Steps/questions already recorded in the session. */
  done: number;
  /** Steps (chord level) or questions (ear level) in the session. */
  total: number;
}

export interface TodayDto {
  day: string;
  /** "Good evening, Harry." */
  greeting: string;
  /** "About 10 minutes today. No tempo, no rush — just play each chord cleanly." */
  subtitle: string;
  /** "3 blocks · ~10 min". */
  summary: string;
  estimateMin: number;
  blocks: PlanBlockDto[];
  cta: CtaDto;
  allDone: boolean;
  tracks: TrackCardDto[];
  /** The most recent unfinished session started today with at least one recorded step. */
  resume: ResumeDto | null;
}

// ---------------------------------------------------------------- tracks.overview

export type NodeState = 'done' | 'current' | 'upcoming';
export type LadderLevelState = 'done' | 'current' | 'upcoming' | 'locked';
export type StageState = 'locked' | 'open' | 'complete';

export interface CircleNodeDto {
  levelId: string;
  /** "A major". */
  title: string;
  /** "A" · "F♯" · "Am". */
  label: string;
  state: NodeState;
  mastered: boolean;
  dueCount: number;
}

export interface LadderLevelDto {
  levelId: string;
  title: string;
  /** 1-based within the stage. */
  number: number;
  state: LadderLevelState;
}

export interface StageDto {
  stageId: string;
  title: string;
  blurb: string;
  state: StageState;
  /** "Unlocks at Intervals L4" · "Unlocks after Scale degrees L3"; null when unlocked. */
  unlockText: string | null;
  /** "Level 3 of 6" (open) · "Complete" · null (locked). */
  progressText: string | null;
  levels: LadderLevelDto[];
}

export interface UpNextDto {
  levelId: string;
  /** "A major" · "Level 3". */
  title: string;
  /** Ladder: "Intervals". */
  stageTitle: string | null;
  blurb: string;
  /** "Start A major" · "Start Level 3". */
  label: string;
  route: string;
}

export interface TrackOverviewDto {
  trackId: string;
  title: string;
  blurb: string;
  map: Track['map'];
  available: boolean;
  enrolled: boolean;
  active: boolean;
  visibility: Visibility;
  hasLesson: boolean;
  lessonSeen: boolean;
  progress: { done: number; total: number; label: string };
  /** "C, G, D". */
  completedTitles: string;
  nodes: CircleNodeDto[] | null;
  stages: StageDto[] | null;
  upNext: UpNextDto | null;
}

// ---------------------------------------------------------------- sessions.*

export interface SessionStartInput {
  levelId: string;
  kind: SessionKind;
  planBlockId?: string;
}

/** A chord-level step with its last scheduled result. */
export type SessionStepDto = Step & {
  lastResult: StepResult | null;
  dueOn: string | null;
  intervalDays: number;
};

/** An ear question: the full selected step plus its ordinal (the renderer never re-selects). */
export type SessionQuestionDto = Step & { ordinal: number };

/** A step already recorded in this session (resume). */
export interface SessionResultDto {
  ordinal: number;
  stepId: string;
  result: StepResult;
  hintLevel: number;
  chosen: string | null;
  tries: number | null;
  playedBack: boolean;
  elapsedMs: number | null;
}

export interface SessionDto {
  sessionId: string;
  trackId: string;
  trackTitle: string;
  levelId: string;
  levelTitle: string;
  /** "A major" · "Intervals · Level 3". */
  shortTitle: string;
  stageTitle: string | null;
  kind: SessionKind;
  isEar: boolean;
  planBlockId: string | null;
  startedAt: number;
  finishedAt: number | null;
  /** True when an unfinished session from today was returned instead of a new one. */
  resumed: boolean;
  visibility: Visibility;
  pass: Pass | null;
  /** Chord levels: the level's steps in order. Ear levels: []. */
  steps: SessionStepDto[];
  /** Ear levels: the selected questions in order. Chord levels: []. */
  questions: SessionQuestionDto[];
  /** Recorded results so far, by ordinal. */
  results: SessionResultDto[];
}

export interface RecordStepInput {
  sessionId: string;
  stepId: string;
  ordinal: number;
  result: StepResult;
  hintLevel: number;
  chosen?: string | null;
  tries?: number | null;
  elapsedMs?: number | null;
}

export interface RecordStepResult {
  xpAwarded: number;
  xpTotal: number;
  dueOn: string | null;
  intervalDays: number;
}

export interface RecordPlaybackInput {
  sessionId: string;
  ordinal: number;
}

export interface RecordPlaybackResult {
  xpAwarded: number;
  xpTotal: number;
}

export interface FinishSessionInput {
  sessionId: string;
  durationMs: number;
  abandoned?: boolean;
}

export interface CompleteChipDto {
  ordinal: number;
  stepId: string;
  /** "vii°" · "P4". */
  label: string;
  /** "G♯°" · "Perfect 4th". */
  short: string;
  quality: Quality | null;
  result: StepResult;
}

export interface XpBreakdownDto {
  /** Level bonus (the Complete tile shows this only, as designed). */
  level: number;
  steps: number;
  playback: number;
  total: number;
  newTotal: number;
}

export interface CompleteDto {
  sessionId: string;
  kind: SessionKind;
  trackId: string;
  levelId: string;
  levelTitle: string;
  shortTitle: string;
  isEar: boolean;
  /** "A major, complete". */
  title: string;
  /** "All seven diatonic chords. That's four keys around the circle." */
  subtitle: string;
  /** Chord: every step resolved; ear: passed. False when abandoned. */
  completed: boolean;
  /** Ear: correct ≥ pass.correct; chord: same as completed. */
  passed: boolean;
  firstCompletion: boolean;
  durationMs: number;
  /** Chord: number of steps (7); ear: number of questions. */
  total: number;
  cleanCount: number;
  hintedCount: number;
  skippedCount: number;
  markedCount: number;
  wrongCount: number;
  /** Ear only. */
  correct: number | null;
  pass: Pass | null;
  chips: CompleteChipDto[];
  xp: XpBreakdownDto;
  streak: StreakDto;
  track: {
    id: string;
    title: string;
    done: number;
    total: number;
    /** "keys" (circle) · "levels" (ladder). */
    unit: string;
    nextLevelId: string | null;
    nextTitle: string | null;
  };
  /** "G♯° will come back in tomorrow's review until it's clean." */
  reviewNote: string;
  /** "Keep going — E major" / "Keep going — Level 4"; null when nothing is next or not passed. */
  next: { levelId: string; label: string; route: string } | null;
  levelStatus: LevelStatus;
}
