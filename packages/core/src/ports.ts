// Ports: the persistence and time interfaces the engine services depend on.
// Types only. `@cadence/db` implements these with Drizzle; tests may use fakes.
// Row shapes mirror docs/engine.md §3 (snake_case columns → camelCase fields).
// Conventions: ids are text, timestamps are epoch-ms numbers, days are local
// `YYYY-MM-DD` strings, optional columns are `T | null`.

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
  /** Local calendar day (`YYYY-MM-DD`) in the given IANA timezone. */
  today(timezone: string): string;
}

// ---------------------------------------------------------------------------
// Enums (stored as text)
// ---------------------------------------------------------------------------

export type Visibility = 'num' | 'name' | 'all';
export type LevelStatus = 'available' | 'in_progress' | 'completed';
export type SessionKind = 'warmup' | 'learn' | 'review' | 'free';
/** engine.md §4 focus rounds: `misses` = "Drill what you missed" (no pass, no completion). */
export type SessionFocus = 'misses';
/** Circle run (decisions.md 2026-10-03): play every key in circle order regardless of completion. */
export type SessionRun = 'circle';
export type StepResult = 'clean' | 'hinted' | 'skipped' | 'marked' | 'wrong';
export type XpReason = 'step' | 'level' | 'playback';
export type PlanBlockType = 'warmup' | 'learn' | 'review';
export type PlanBlockStatus = 'pending' | 'in_progress' | 'done';

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/**
 * The app synth's voice (decisions.md 2026-10-11 "Sound setting"): the original triangle tone,
 * a synthesized piano, or the recorded piano samples.
 */
export type SoundVoice = 'tone' | 'synth' | 'samples';

export interface ProfileRow {
  /** Always 'local' (single local profile). */
  id: string;
  name: string;
  timezone: string;
  xpTotal: number;
  midiDeviceId: string | null;
  midiDeviceName: string | null;
  showMarkPlayedAlways: boolean;
  /** Hands-free key loop: auto-finish + auto-advance (decisions.md 2026-10-01). */
  autoContinue: boolean;
  voice: SoundVoice;
  createdAt: number;
  updatedAt: number;
}

export interface TrackSettingsRow {
  trackId: string;
  visibility: Visibility;
  active: boolean;
  enrolledAt: number;
  lastNewLevelAt: number | null;
  lessonSeenAt: number | null;
}

export interface StepProgressRow {
  id: string;
  trackId: string;
  levelId: string;
  stepId: string;
  /** −1 = none; 0..4 index into INTERVALS [1,3,7,14,30]. */
  intervalIndex: number;
  intervalDays: number;
  dueOn: string | null;
  lastResult: StepResult | null;
  lastSeenAt: number;
  timesSeen: number;
  timesClean: number;
  timesHinted: number;
  timesWrong: number;
  createdAt: number;
  updatedAt: number;
}

export interface LevelProgressRow {
  levelId: string;
  trackId: string;
  status: LevelStatus;
  attempts: number;
  firstCompletedAt: number | null;
  lastCompletedAt: number | null;
  lastScore: number;
  bestScore: number;
  bestTimeMs: number | null;
  mastered: boolean;
  masteredAt: number | null;
  updatedAt: number;
}

export interface SessionRow {
  id: string;
  trackId: string;
  levelId: string;
  kind: SessionKind;
  planBlockId: string | null;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number | null;
  stepsTotal: number;
  stepsClean: number;
  stepsHinted: number;
  stepsSkipped: number;
  stepsMarked: number;
  stepsWrong: number;
  correct: number | null;
  passed: boolean | null;
  xpSteps: number;
  xpLevel: number;
  xpPlayback: number;
  /** Ear sessions: the step ids in question order. */
  questionOrder: string[] | null;
  /** Focus round (engine.md §4); null for a normal session. */
  focus: SessionFocus | null;
  /** Circle run (decisions.md 2026-10-03); null for a one-off session. */
  run: SessionRun | null;
}

export interface SessionStepRow {
  id: string;
  sessionId: string;
  levelId: string;
  stepId: string;
  ordinal: number;
  result: StepResult;
  hintLevel: number;
  tries: number | null;
  chosen: string | null;
  playedBack: boolean;
  elapsedMs: number | null;
  createdAt: number;
}

export interface XpLedgerRow {
  id: string;
  amount: number;
  reason: XpReason;
  sessionId: string | null;
  stepId: string | null;
  day: string;
  createdAt: number;
}

export interface DayLogRow {
  day: string;
  blocksCompleted: number;
  sessionsCompleted: number;
  xp: number;
  firstCompletedAt: number;
}

export interface DailyPlanRow {
  day: string;
  generatedAt: number;
  learnTrackId: string | null;
}

export interface PlanBlockRow {
  id: string;
  day: string;
  /** 0..2 */
  slot: number;
  type: PlanBlockType;
  trackId: string;
  levelId: string;
  title: string;
  blurb: string;
  estimateMin: number;
  status: PlanBlockStatus;
  sessionId: string | null;
  completedAt: number | null;
  lessonFirst: boolean;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface NewProfile {
  name: string;
  timezone: string;
  now: number;
}

export type ProfilePatch = Partial<
  Pick<
    ProfileRow,
    | 'name'
    | 'timezone'
    | 'midiDeviceId'
    | 'midiDeviceName'
    | 'showMarkPlayedAlways'
    | 'autoContinue'
    | 'voice'
  >
>;

export type TrackSettingsPatch = Partial<Omit<TrackSettingsRow, 'trackId'>>;

/** Full row minus the generated id; on conflict (levelId, stepId) every field but createdAt is replaced. */
export type StepProgressUpsert = Omit<StepProgressRow, 'id'>;

export interface NewSession {
  id?: string;
  trackId: string;
  levelId: string;
  kind: SessionKind;
  planBlockId?: string | null;
  startedAt: number;
  questionOrder?: string[] | null;
  focus?: SessionFocus | null;
  run?: SessionRun | null;
}

export type SessionPatch = Partial<Omit<SessionRow, 'id'>>;

/**
 * Idempotent on (sessionId, ordinal): a retry replaces the result fields and keeps the
 * original id/createdAt. `playedBack` is only written when provided.
 */
export interface SessionStepUpsert {
  id?: string;
  sessionId: string;
  levelId: string;
  stepId: string;
  ordinal: number;
  result: StepResult;
  hintLevel: number;
  tries: number | null;
  chosen: string | null;
  playedBack?: boolean;
  elapsedMs: number | null;
  createdAt: number;
}

export interface NewXpEntry {
  id?: string;
  amount: number;
  reason: XpReason;
  sessionId: string | null;
  stepId: string | null;
  day: string;
  createdAt: number;
}

export interface DayLogIncrement {
  day: string;
  blocks: number;
  sessions: number;
  xp: number;
  /** Used only when the day row is created. */
  at: number;
}

export type NewPlanBlock = Omit<PlanBlockRow, 'id'> & { id?: string };

export type PlanBlockPatch = Partial<Pick<PlanBlockRow, 'status' | 'sessionId' | 'completedAt'>>;

export interface DueCount {
  levelId: string;
  trackId: string;
  count: number;
  earliestDueOn: string;
}

export interface PlanWithBlocks {
  plan: DailyPlanRow;
  /** Ordered by slot. */
  blocks: PlanBlockRow[];
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export interface ProfileRepo {
  get(): ProfileRow | null;
  /** Creates the single local profile with xpTotal 0. Throws if it already exists. */
  create(input: NewProfile): ProfileRow;
  update(patch: ProfilePatch, now: number): ProfileRow;
  /** Atomically adds `amount` to xp_total and returns the new total. */
  addXp(amount: number, now: number): number;
}

export interface TrackSettingsRepo {
  get(trackId: string): TrackSettingsRow | null;
  list(): TrackSettingsRow[];
  /** Insert, or replace every field on conflict (trackId). */
  upsert(row: TrackSettingsRow): TrackSettingsRow;
  update(trackId: string, patch: TrackSettingsPatch): TrackSettingsRow | null;
}

export interface StepProgressRepo {
  get(levelId: string, stepId: string): StepProgressRow | null;
  listByLevel(levelId: string): StepProgressRow[];
  listByTrack(trackId: string): StepProgressRow[];
  /** Steps with `dueOn ≤ today`, ordered by dueOn, levelId, stepId. */
  listDue(today: string): StepProgressRow[];
  /** Per-level counts of steps with `dueOn ≤ today`. */
  dueCountByLevel(today: string): DueCount[];
  upsert(row: StepProgressUpsert): StepProgressRow;
}

export interface LevelProgressRepo {
  get(levelId: string): LevelProgressRow | null;
  listByTrack(trackId: string): LevelProgressRow[];
  listAll(): LevelProgressRow[];
  listMastered(): LevelProgressRow[];
  /** Insert, or replace every field on conflict (levelId). */
  upsert(row: LevelProgressRow): LevelProgressRow;
}

export interface SessionRepo {
  create(input: NewSession): SessionRow;
  get(id: string): SessionRow | null;
  update(id: string, patch: SessionPatch): SessionRow | null;
  /** Ordered by startedAt. */
  listByLevel(levelId: string): SessionRow[];
  /** startedAt in [fromMs, toMs), ordered by startedAt. */
  listStartedBetween(fromMs: number, toMs: number): SessionRow[];

  upsertStep(step: SessionStepUpsert): SessionStepRow;
  /** Ordered by ordinal. */
  listSteps(sessionId: string): SessionStepRow[];
  /** Sets played_back once; returns true only if it was previously false. */
  markPlayedBack(sessionId: string, ordinal: number): boolean;
}

export interface XpRepo {
  /** Ledger insert + profile.xp_total increment in one transaction. */
  award(entry: NewXpEntry): { entry: XpLedgerRow; newTotal: number };
  listBySession(sessionId: string): XpLedgerRow[];
  listByDay(day: string): XpLedgerRow[];
  sumByDay(day: string): number;
}

export interface DayLogRepo {
  get(day: string): DayLogRow | null;
  /** Inclusive range, ascending by day. */
  listRange(fromDay: string, toDay: string): DayLogRow[];
  /** Insert, or replace every field on conflict (day). */
  upsert(row: DayLogRow): DayLogRow;
  /** Insert, or add the counters on conflict (day); firstCompletedAt is kept. */
  increment(input: DayLogIncrement): DayLogRow;
}

export interface PlanRepo {
  get(day: string): PlanWithBlocks | null;
  /** Upserts the plan (day) and its blocks (day, slot) in one transaction. */
  save(plan: DailyPlanRow, blocks: NewPlanBlock[]): PlanWithBlocks;
  getBlock(id: string): PlanBlockRow | null;
  updateBlock(id: string, patch: PlanBlockPatch): PlanBlockRow | null;
}

export interface Repos {
  profile: ProfileRepo;
  trackSettings: TrackSettingsRepo;
  stepProgress: StepProgressRepo;
  levelProgress: LevelProgressRepo;
  sessions: SessionRepo;
  xp: XpRepo;
  dayLog: DayLogRepo;
  plans: PlanRepo;
  /** Runs `fn` atomically (synchronous; nests as a savepoint). */
  transaction<T>(fn: () => T): T;
}
