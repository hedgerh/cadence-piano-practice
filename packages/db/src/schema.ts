// Drizzle schema — docs/engine.md §3. Single local profile; text ids (nanoid);
// integer epoch-ms timestamps; `YYYY-MM-DD` local days; text enums;
// integer-mode booleans. After editing, run `pnpm db:generate`.
import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import type {
  LevelStatus,
  PlanBlockStatus,
  PlanBlockType,
  SessionFocus,
  SessionKind,
  SessionRun,
  StepResult,
  Visibility,
  XpReason,
} from '@cadence/core';

const VISIBILITY = ['num', 'name', 'all'] as const satisfies readonly Visibility[];
const LEVEL_STATUS = [
  'available',
  'in_progress',
  'completed',
] as const satisfies readonly LevelStatus[];
const SESSION_KIND = [
  'warmup',
  'learn',
  'review',
  'free',
] as const satisfies readonly SessionKind[];
const SESSION_FOCUS = ['misses'] as const satisfies readonly SessionFocus[];
const SESSION_RUN = ['circle'] as const satisfies readonly SessionRun[];
const STEP_RESULT = [
  'clean',
  'hinted',
  'skipped',
  'marked',
  'wrong',
] as const satisfies readonly StepResult[];
const XP_REASON = ['step', 'level', 'playback'] as const satisfies readonly XpReason[];
const PLAN_BLOCK_TYPE = ['warmup', 'learn', 'review'] as const satisfies readonly PlanBlockType[];
const PLAN_BLOCK_STATUS = [
  'pending',
  'in_progress',
  'done',
] as const satisfies readonly PlanBlockStatus[];

const bool = (name: string) => integer(name, { mode: 'boolean' });

export const profile = sqliteTable('profile', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  xpTotal: integer('xp_total').notNull().default(0),
  midiDeviceId: text('midi_device_id'),
  midiDeviceName: text('midi_device_name'),
  showMarkPlayedAlways: bool('show_mark_played_always').notNull().default(false),
  autoContinue: bool('auto_continue').notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const trackSettings = sqliteTable('track_settings', {
  trackId: text('track_id').primaryKey(),
  visibility: text('visibility', { enum: VISIBILITY }).notNull().default('all'),
  active: bool('active').notNull().default(true),
  enrolledAt: integer('enrolled_at').notNull(),
  lastNewLevelAt: integer('last_new_level_at'),
  lessonSeenAt: integer('lesson_seen_at'),
});

export const stepProgress = sqliteTable(
  'step_progress',
  {
    id: text('id').primaryKey(),
    trackId: text('track_id').notNull(),
    levelId: text('level_id').notNull(),
    stepId: text('step_id').notNull(),
    intervalIndex: integer('interval_index').notNull().default(-1),
    intervalDays: integer('interval_days').notNull().default(0),
    dueOn: text('due_on'),
    lastResult: text('last_result', { enum: STEP_RESULT }),
    lastSeenAt: integer('last_seen_at').notNull(),
    timesSeen: integer('times_seen').notNull().default(0),
    timesClean: integer('times_clean').notNull().default(0),
    timesHinted: integer('times_hinted').notNull().default(0),
    timesWrong: integer('times_wrong').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('step_progress_level_step_uq').on(t.levelId, t.stepId),
    index('step_progress_due_on_idx').on(t.dueOn),
    index('step_progress_level_idx').on(t.levelId),
  ],
);

export const levelProgress = sqliteTable(
  'level_progress',
  {
    levelId: text('level_id').primaryKey(),
    trackId: text('track_id').notNull(),
    status: text('status', { enum: LEVEL_STATUS }).notNull().default('available'),
    attempts: integer('attempts').notNull().default(0),
    firstCompletedAt: integer('first_completed_at'),
    lastCompletedAt: integer('last_completed_at'),
    lastScore: integer('last_score').notNull().default(0),
    bestScore: integer('best_score').notNull().default(0),
    bestTimeMs: integer('best_time_ms'),
    mastered: bool('mastered').notNull().default(false),
    masteredAt: integer('mastered_at'),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('level_progress_track_idx').on(t.trackId),
    index('level_progress_mastered_idx').on(t.mastered),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    trackId: text('track_id').notNull(),
    levelId: text('level_id').notNull(),
    kind: text('kind', { enum: SESSION_KIND }).notNull(),
    planBlockId: text('plan_block_id'),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
    durationMs: integer('duration_ms'),
    stepsTotal: integer('steps_total').notNull().default(0),
    stepsClean: integer('steps_clean').notNull().default(0),
    stepsHinted: integer('steps_hinted').notNull().default(0),
    stepsSkipped: integer('steps_skipped').notNull().default(0),
    stepsMarked: integer('steps_marked').notNull().default(0),
    stepsWrong: integer('steps_wrong').notNull().default(0),
    correct: integer('correct'),
    passed: bool('passed'),
    xpSteps: integer('xp_steps').notNull().default(0),
    xpLevel: integer('xp_level').notNull().default(0),
    xpPlayback: integer('xp_playback').notNull().default(0),
    questionOrder: text('question_order', { mode: 'json' }).$type<string[]>(),
    /** engine.md §4 focus rounds: 'misses' or null. */
    focus: text('focus', { enum: SESSION_FOCUS }),
    /** Circle run (decisions.md 2026-10-03): 'circle' or null. */
    run: text('run', { enum: SESSION_RUN }),
  },
  (t) => [
    index('sessions_started_at_idx').on(t.startedAt),
    index('sessions_level_idx').on(t.levelId),
  ],
);

export const sessionSteps = sqliteTable(
  'session_steps',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references((): AnySQLiteColumn => sessions.id, { onDelete: 'cascade' }),
    levelId: text('level_id').notNull(),
    stepId: text('step_id').notNull(),
    ordinal: integer('ordinal').notNull(),
    result: text('result', { enum: STEP_RESULT }).notNull(),
    hintLevel: integer('hint_level').notNull().default(0),
    tries: integer('tries'),
    chosen: text('chosen'),
    playedBack: bool('played_back').notNull().default(false),
    elapsedMs: integer('elapsed_ms'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('session_steps_session_ordinal_uq').on(t.sessionId, t.ordinal)],
);

export const xpLedger = sqliteTable(
  'xp_ledger',
  {
    id: text('id').primaryKey(),
    amount: integer('amount').notNull(),
    reason: text('reason', { enum: XP_REASON }).notNull(),
    sessionId: text('session_id').references((): AnySQLiteColumn => sessions.id, {
      onDelete: 'set null',
    }),
    stepId: text('step_id'),
    day: text('day').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('xp_ledger_day_idx').on(t.day)],
);

export const dayLog = sqliteTable('day_log', {
  day: text('day').primaryKey(),
  blocksCompleted: integer('blocks_completed').notNull().default(0),
  sessionsCompleted: integer('sessions_completed').notNull().default(0),
  xp: integer('xp').notNull().default(0),
  firstCompletedAt: integer('first_completed_at').notNull(),
});

export const dailyPlans = sqliteTable('daily_plans', {
  day: text('day').primaryKey(),
  generatedAt: integer('generated_at').notNull(),
  learnTrackId: text('learn_track_id'),
});

export const planBlocks = sqliteTable(
  'plan_blocks',
  {
    id: text('id').primaryKey(),
    day: text('day')
      .notNull()
      .references((): AnySQLiteColumn => dailyPlans.day, { onDelete: 'cascade' }),
    slot: integer('slot').notNull(),
    type: text('type', { enum: PLAN_BLOCK_TYPE }).notNull(),
    trackId: text('track_id').notNull(),
    levelId: text('level_id').notNull(),
    title: text('title').notNull(),
    blurb: text('blurb').notNull(),
    estimateMin: integer('estimate_min').notNull(),
    status: text('status', { enum: PLAN_BLOCK_STATUS }).notNull().default('pending'),
    sessionId: text('session_id'),
    completedAt: integer('completed_at'),
    lessonFirst: bool('lesson_first').notNull().default(false),
  },
  (t) => [uniqueIndex('plan_blocks_day_slot_uq').on(t.day, t.slot)],
);
