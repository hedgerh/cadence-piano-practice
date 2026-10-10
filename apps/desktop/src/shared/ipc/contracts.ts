import { PassSchema, QualitySchema, StepSchema, TrackSchema, type Track } from '@cadence/content';
import type {
  CompleteDto,
  FinishSessionInput,
  MeDto,
  MeUpdate,
  RecordPlaybackInput,
  RecordPlaybackResult,
  RecordStepInput,
  RecordStepResult,
  SeedScenario,
  SessionDto,
  SessionStartInput,
  TodayDto,
  TrackOverviewDto,
  TrackSettingsDto,
  TrackSettingsInput,
  TrackSummaryDto,
} from '@cadence/core';
import { z } from 'zod';

/**
 * The single source of truth for renderer <-> main communication.
 *
 * Adding a procedure = add a key here + implement it in main/ipc/handlers.ts.
 * Preload never changes. Main validates input AND output; the renderer client
 * (renderer/lib/api.ts) re-validates output defensively.
 *
 * Channels are listed in docs/architecture.md §3. Output schemas mirror the DTO
 * types in @cadence/core/dto.ts exactly; the type-level assertions at the bottom
 * of this file fail `pnpm typecheck` if the two drift. The renderer takes its
 * DTO types from `ChannelOutput<C>` (it never imports @cadence/core); the only
 * reference to core here is `import type`, erased at build time.
 */

// ---------------------------------------------------------------- enums (core/ports.ts)

const VisibilitySchema = z.enum(['num', 'name', 'all']);
const LevelStatusSchema = z.enum(['available', 'in_progress', 'completed']);
/** What a practice level's steps are called in copy (`stepNoun` in @cadence/content). */
const StepNounSchema = z.enum(['chord', 'scale', 'step']);
const SessionKindSchema = z.enum(['warmup', 'learn', 'review', 'free']);
const SessionFocusSchema = z.enum(['misses']);
const SessionRunSchema = z.enum(['circle']);
const StepResultSchema = z.enum(['clean', 'hinted', 'skipped', 'marked', 'wrong']);
const PlanBlockTypeSchema = z.enum(['warmup', 'learn', 'review']);
const PlanBlockStatusSchema = z.enum(['pending', 'in_progress', 'done']);
const MapSchema = TrackSchema.shape.map;

/** Ids, ordinals and counters arriving from the renderer. */
const id = z.string().min(1);
const count = z.number().int().nonnegative();

// ---------------------------------------------------------------- me.get / me.update

const StreakSchema = z.object({
  days: z.number(),
  keptToday: z.boolean(),
  atRisk: z.boolean(),
});

export const MeSchema = z.object({
  name: z.string(),
  timezone: z.string(),
  xpTotal: z.number(),
  streak: StreakSchema,
  midi: z.object({
    deviceId: z.string().exactOptional(),
    deviceName: z.string().exactOptional(),
  }),
  settings: z.object({ showMarkPlayedAlways: z.boolean(), autoContinue: z.boolean() }),
  firstRun: z.boolean(),
});

export const MeUpdateSchema = z.object({
  name: z.string().min(1).exactOptional(),
  timezone: z.string().min(1).exactOptional(),
  midi: z
    .object({
      deviceId: z.string().nullable().exactOptional(),
      deviceName: z.string().nullable().exactOptional(),
    })
    .exactOptional(),
  settings: z
    .object({
      showMarkPlayedAlways: z.boolean().exactOptional(),
      autoContinue: z.boolean().exactOptional(),
    })
    .exactOptional(),
});

// ---------------------------------------------------------------- content.*

export const TrackSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  group: z.string(),
  map: MapSchema,
  available: z.boolean(),
});

const TrackIdInputSchema = z.object({ trackId: id });

// ---------------------------------------------------------------- tracks.setSettings

export const TrackSettingsInputSchema = z.object({
  trackId: id,
  visibility: VisibilitySchema.exactOptional(),
  active: z.boolean().exactOptional(),
});

export const TrackSettingsSchema = z.object({
  trackId: z.string(),
  visibility: VisibilitySchema,
  active: z.boolean(),
  enrolled: z.boolean(),
  lessonSeen: z.boolean(),
});

// ---------------------------------------------------------------- plan.getToday

const PlanBlockSchema = z.object({
  id: z.string(),
  slot: z.number(),
  type: PlanBlockTypeSchema,
  kind: SessionKindSchema,
  trackId: z.string(),
  levelId: z.string(),
  eyebrow: z.string(),
  title: z.string(),
  shortTitle: z.string(),
  blurb: z.string(),
  estimateMin: z.number(),
  status: PlanBlockStatusSchema,
  meta: z.string(),
  sessionId: z.string().nullable(),
  lessonFirst: z.boolean(),
  route: z.string(),
  isEar: z.boolean(),
});

const CtaSchema = z.object({
  label: z.string(),
  route: z.string(),
  subtitle: z.string().nullable(),
  blockId: z.string().nullable(),
  levelId: z.string().nullable(),
  kind: SessionKindSchema.nullable(),
  lessonFirst: z.boolean(),
});

const TrackCardSchema = z.object({
  trackId: z.string(),
  title: z.string(),
  group: z.string(),
  blurb: z.string(),
  map: MapSchema,
  available: z.boolean(),
  enrolled: z.boolean(),
  active: z.boolean(),
  status: z.enum(['in_progress', 'ready', 'not_started', 'complete']),
  statusLabel: z.string(),
  done: z.number(),
  total: z.number(),
  progressText: z.string(),
  nextText: z.string().nullable(),
  currentLabel: z.string().nullable(),
  currentLevelId: z.string().nullable(),
});

const ResumeSchema = z.object({
  sessionId: z.string(),
  levelId: z.string(),
  trackId: z.string(),
  title: z.string(),
  isEar: z.boolean(),
  stepNoun: StepNounSchema,
  done: z.number(),
  total: z.number(),
});

export const TodaySchema = z.object({
  day: z.string(),
  greeting: z.string(),
  subtitle: z.string(),
  summary: z.string(),
  estimateMin: z.number(),
  blocks: z.array(PlanBlockSchema),
  cta: CtaSchema,
  allDone: z.boolean(),
  tracks: z.array(TrackCardSchema),
  resume: ResumeSchema.nullable(),
});

// ---------------------------------------------------------------- tracks.overview

const CircleNodeSchema = z.object({
  levelId: z.string(),
  title: z.string(),
  label: z.string(),
  state: z.enum(['done', 'current', 'upcoming']),
  mastered: z.boolean(),
  dueCount: z.number(),
});

const LadderLevelSchema = z.object({
  levelId: z.string(),
  title: z.string(),
  blurb: z.string(),
  number: z.number(),
  state: z.enum(['done', 'current', 'upcoming', 'locked']),
});

const StageOverviewSchema = z.object({
  stageId: z.string(),
  title: z.string(),
  blurb: z.string(),
  state: z.enum(['locked', 'open', 'complete']),
  unlockText: z.string().nullable(),
  progressText: z.string().nullable(),
  levels: z.array(LadderLevelSchema),
});

const UpNextSchema = z.object({
  levelId: z.string(),
  title: z.string(),
  stageTitle: z.string().nullable(),
  blurb: z.string(),
  label: z.string(),
  route: z.string(),
});

export const TrackOverviewSchema = z.object({
  trackId: z.string(),
  title: z.string(),
  blurb: z.string(),
  map: MapSchema,
  available: z.boolean(),
  enrolled: z.boolean(),
  active: z.boolean(),
  visibility: VisibilitySchema,
  hasLesson: z.boolean(),
  lessonSeen: z.boolean(),
  progress: z.object({ done: z.number(), total: z.number(), label: z.string() }),
  completedTitles: z.string(),
  nodes: z.array(CircleNodeSchema).nullable(),
  stages: z.array(StageOverviewSchema).nullable(),
  upNext: UpNextSchema.nullable(),
});

// ---------------------------------------------------------------- sessions.*

export const SessionStartInputSchema = z.object({
  levelId: id,
  kind: SessionKindSchema,
  planBlockId: id.exactOptional(),
  focus: SessionFocusSchema.exactOptional(),
  run: SessionRunSchema.exactOptional(),
});

const SessionIdInputSchema = z.object({ sessionId: id });

const SessionStepSchema = StepSchema.extend({
  lastResult: StepResultSchema.nullable(),
  dueOn: z.string().nullable(),
  intervalDays: z.number(),
});

const SessionQuestionSchema = StepSchema.extend({ ordinal: z.number() });

const SessionResultSchema = z.object({
  ordinal: z.number(),
  stepId: z.string(),
  result: StepResultSchema,
  hintLevel: z.number(),
  chosen: z.string().nullable(),
  tries: z.number().nullable(),
  playedBack: z.boolean(),
  elapsedMs: z.number().nullable(),
});

export const SessionSchema = z.object({
  sessionId: z.string(),
  trackId: z.string(),
  trackTitle: z.string(),
  levelId: z.string(),
  levelTitle: z.string(),
  levelNote: z.string().nullable(),
  shortTitle: z.string(),
  stageTitle: z.string().nullable(),
  kind: SessionKindSchema,
  isEar: z.boolean(),
  planBlockId: z.string().nullable(),
  startedAt: z.number(),
  finishedAt: z.number().nullable(),
  resumed: z.boolean(),
  visibility: VisibilitySchema,
  pass: PassSchema.nullable(),
  steps: z.array(SessionStepSchema),
  questions: z.array(SessionQuestionSchema),
  results: z.array(SessionResultSchema),
  focus: SessionFocusSchema.nullable(),
  run: SessionRunSchema.nullable(),
});

export const RecordStepInputSchema = z.object({
  sessionId: id,
  stepId: id,
  ordinal: count,
  result: StepResultSchema,
  hintLevel: count,
  chosen: z.string().nullable().exactOptional(),
  tries: count.nullable().exactOptional(),
  elapsedMs: count.nullable().exactOptional(),
});

export const RecordStepResultSchema = z.object({
  xpAwarded: z.number(),
  xpTotal: z.number(),
  dueOn: z.string().nullable(),
  intervalDays: z.number(),
});

export const RecordPlaybackInputSchema = z.object({ sessionId: id, ordinal: count });

export const RecordPlaybackResultSchema = z.object({
  xpAwarded: z.number(),
  xpTotal: z.number(),
});

export const FinishSessionInputSchema = z.object({
  sessionId: id,
  durationMs: count,
  abandoned: z.boolean().exactOptional(),
});

const CompleteChipSchema = z.object({
  ordinal: z.number(),
  stepId: z.string(),
  label: z.string(),
  short: z.string(),
  quality: QualitySchema.nullable(),
  result: StepResultSchema,
});

const XpBreakdownSchema = z.object({
  level: z.number(),
  steps: z.number(),
  playback: z.number(),
  total: z.number(),
  newTotal: z.number(),
});

export const CompleteSchema = z.object({
  sessionId: z.string(),
  kind: SessionKindSchema,
  trackId: z.string(),
  levelId: z.string(),
  levelTitle: z.string(),
  shortTitle: z.string(),
  isEar: z.boolean(),
  stepNoun: StepNounSchema,
  title: z.string(),
  subtitle: z.string(),
  completed: z.boolean(),
  passed: z.boolean(),
  firstCompletion: z.boolean(),
  durationMs: z.number(),
  total: z.number(),
  cleanCount: z.number(),
  hintedCount: z.number(),
  skippedCount: z.number(),
  markedCount: z.number(),
  wrongCount: z.number(),
  correct: z.number().nullable(),
  pass: PassSchema.nullable(),
  chips: z.array(CompleteChipSchema),
  xp: XpBreakdownSchema,
  streak: StreakSchema,
  track: z.object({
    id: z.string(),
    title: z.string(),
    done: z.number(),
    total: z.number(),
    unit: z.string(),
    nextLevelId: z.string().nullable(),
    nextTitle: z.string().nullable(),
  }),
  reviewNote: z.string(),
  next: z
    .object({
      levelId: z.string(),
      label: z.string(),
      route: z.string(),
      run: SessionRunSchema.nullable(),
    })
    .nullable(),
  levelStatus: LevelStatusSchema,
  focus: SessionFocusSchema.nullable(),
  run: SessionRunSchema.nullable(),
  runPosition: z.number().nullable(),
});

// ---------------------------------------------------------------- dev.seed

export const SeedScenarioSchema = z.enum([
  'first-run',
  'day8',
  'ear-unlocked',
  'all-complete',
  'advance-day',
]);

// ---------------------------------------------------------------- the contract

export const contracts = {
  /** Liveness check used by the e2e smoke test and the dev tools. */
  'app.ping': {
    input: z.void(),
    output: z.object({
      ok: z.literal(true),
      version: z.string(),
      userDataPath: z.string(),
      /** dev: unpackaged run; e2e: CADENCE_E2E=1. Either enables window.__cadenceDev. */
      env: z.object({ dev: z.boolean(), e2e: z.boolean() }),
    }),
  },

  'me.get': { input: z.void(), output: MeSchema },
  /** Onboarding and the MIDI pill; creates the profile on first run. */
  'me.update': { input: MeUpdateSchema, output: MeSchema },

  'content.tracks': { input: z.void(), output: z.array(TrackSummarySchema) },
  /** Full track content, validated with @cadence/content's own schema. */
  'content.track': { input: TrackIdInputSchema, output: TrackSchema },

  'plan.getToday': { input: z.void(), output: TodaySchema },

  'tracks.overview': { input: TrackIdInputSchema, output: TrackOverviewSchema },
  'tracks.setSettings': { input: TrackSettingsInputSchema, output: TrackSettingsSchema },
  'tracks.lessonSeen': { input: TrackIdInputSchema, output: z.void() },

  'sessions.start': { input: SessionStartInputSchema, output: SessionSchema },
  'sessions.get': { input: SessionIdInputSchema, output: SessionSchema },
  /** Idempotent on (sessionId, ordinal). */
  'sessions.recordStep': { input: RecordStepInputSchema, output: RecordStepResultSchema },
  /** Idempotent. */
  'sessions.recordPlayback': {
    input: RecordPlaybackInputSchema,
    output: RecordPlaybackResultSchema,
  },
  'sessions.finish': { input: FinishSessionInputSchema, output: CompleteSchema },

  /** Registered only when CADENCE_E2E=1 or unpackaged (see main/ipc/handlers.ts). */
  'dev.seed': { input: z.object({ scenario: SeedScenarioSchema }), output: z.void() },
} as const satisfies Record<string, { input: z.ZodType; output: z.ZodType }>;

export type Contracts = typeof contracts;
export type Channel = keyof Contracts;
export type ChannelInput<C extends Channel> = z.input<Contracts[C]['input']>;
export type ChannelOutput<C extends Channel> = z.output<Contracts[C]['output']>;

/** Channels that only exist in dev and e2e runs; a packaged build leaves them unregistered. */
export const devChannels = ['dev.seed'] as const satisfies readonly Channel[];
export type DevChannel = (typeof devChannels)[number];

type Handler<C extends Channel> = (
  input: z.output<Contracts[C]['input']>,
) => Promise<ChannelOutput<C>> | ChannelOutput<C>;

/** What a main-process implementation of every channel looks like (dev channels optional). */
export type Handlers = { [C in Exclude<Channel, DevChannel>]: Handler<C> } & {
  [C in DevChannel]?: Handler<C>;
};

export const channels = Object.keys(contracts) as Channel[];

// ---------------------------------------------------------------- renderer-facing DTO names

export type MeOutput = ChannelOutput<'me.get'>;
export type TodayOutput = ChannelOutput<'plan.getToday'>;
export type TrackOverviewOutput = ChannelOutput<'tracks.overview'>;
export type SessionOutput = ChannelOutput<'sessions.start'>;
export type CompleteOutput = ChannelOutput<'sessions.finish'>;

// ---------------------------------------------------------------- drift guards (types only)

/** Resolves to `true` only when A and B are assignable to each other. */
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Out<C extends Channel> = z.output<Contracts[C]['output']>;
type In<C extends Channel> = z.output<Contracts[C]['input']>;

export type _ContractDriftGuards = [
  Assert<Mutual<Out<'me.get'>, MeDto>>,
  Assert<Mutual<Out<'me.update'>, MeDto>>,
  Assert<Mutual<In<'me.update'>, MeUpdate>>,
  Assert<Mutual<Out<'content.tracks'>, TrackSummaryDto[]>>,
  Assert<Mutual<Out<'content.track'>, Track>>,
  Assert<Mutual<Out<'plan.getToday'>, TodayDto>>,
  Assert<Mutual<Out<'tracks.overview'>, TrackOverviewDto>>,
  Assert<Mutual<In<'tracks.setSettings'>, TrackSettingsInput>>,
  Assert<Mutual<Out<'tracks.setSettings'>, TrackSettingsDto>>,
  Assert<Mutual<In<'sessions.start'>, SessionStartInput>>,
  Assert<Mutual<Out<'sessions.start'>, SessionDto>>,
  Assert<Mutual<Out<'sessions.get'>, SessionDto>>,
  Assert<Mutual<In<'sessions.recordStep'>, RecordStepInput>>,
  Assert<Mutual<Out<'sessions.recordStep'>, RecordStepResult>>,
  Assert<Mutual<In<'sessions.recordPlayback'>, RecordPlaybackInput>>,
  Assert<Mutual<Out<'sessions.recordPlayback'>, RecordPlaybackResult>>,
  Assert<Mutual<In<'sessions.finish'>, FinishSessionInput>>,
  Assert<Mutual<Out<'sessions.finish'>, CompleteDto>>,
  Assert<Mutual<In<'dev.seed'>['scenario'], SeedScenario>>,
];
