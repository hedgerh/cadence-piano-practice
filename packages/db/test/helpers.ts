import type {
  LevelProgressRow,
  NewPlanBlock,
  Repos,
  SessionStepUpsert,
  StepProgressUpsert,
} from '@cadence/core';
import { createRepos, openDatabase, runMigrations, type OpenedDatabase } from '../src';

/** The real generated migrations (packages/db/drizzle). */
export const MIGRATIONS = `${import.meta.dirname}/../drizzle`;

export interface TestDb extends OpenedDatabase {
  repos: Repos;
}

export function freshDb(): TestDb {
  const opened = openDatabase(':memory:');
  runMigrations(opened.db, MIGRATIONS);
  return { ...opened, repos: createRepos(opened.db) };
}

export const T0 = Date.parse('2026-03-08T17:00:00Z');

export function stepRow(overrides: Partial<StepProgressUpsert> = {}): StepProgressUpsert {
  return {
    trackId: 'major-diatonic-chords',
    levelId: 'c-major',
    stepId: 'd1',
    intervalIndex: -1,
    intervalDays: 1,
    dueOn: null,
    lastResult: null,
    lastSeenAt: T0,
    timesSeen: 0,
    timesClean: 0,
    timesHinted: 0,
    timesWrong: 0,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

export function levelRow(overrides: Partial<LevelProgressRow> = {}): LevelProgressRow {
  return {
    levelId: 'c-major',
    trackId: 'major-diatonic-chords',
    status: 'available',
    attempts: 0,
    firstCompletedAt: null,
    lastCompletedAt: null,
    lastScore: 0,
    bestScore: 0,
    bestTimeMs: null,
    mastered: false,
    masteredAt: null,
    updatedAt: T0,
    ...overrides,
  };
}

export function sessionStep(
  sessionId: string,
  overrides: Partial<SessionStepUpsert> = {},
): SessionStepUpsert {
  return {
    sessionId,
    levelId: 'c-major',
    stepId: 'd1',
    ordinal: 0,
    result: 'clean',
    hintLevel: 0,
    tries: null,
    chosen: null,
    elapsedMs: null,
    createdAt: T0,
    ...overrides,
  };
}

export function planBlock(overrides: Partial<NewPlanBlock> = {}): NewPlanBlock {
  return {
    day: '2026-03-08',
    slot: 0,
    type: 'warmup',
    trackId: 'major-diatonic-chords',
    levelId: 'c-major',
    title: 'C major',
    blurb: 'You know this one. Played clean, no hints.',
    estimateMin: 2,
    status: 'pending',
    sessionId: null,
    completedAt: null,
    lessonFirst: false,
    ...overrides,
  };
}
