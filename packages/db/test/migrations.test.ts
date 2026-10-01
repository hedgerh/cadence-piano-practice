import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  DailyPlanRow,
  DayLogRow,
  LevelProgressRow,
  PlanBlockRow,
  ProfileRow,
  SessionRow,
  SessionStepRow,
  StepProgressRow,
  TrackSettingsRow,
  XpLedgerRow,
} from '@cadence/core';
import { runMigrations, type OpenedDatabase, type schema } from '../src';
import { MIGRATIONS, freshDb } from './helpers';

const TABLES = [
  'daily_plans',
  'day_log',
  'level_progress',
  'plan_blocks',
  'profile',
  'session_steps',
  'sessions',
  'step_progress',
  'track_settings',
  'xp_ledger',
];

function objects(sqlite: OpenedDatabase['sqlite'], type: 'table' | 'index') {
  return (
    sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' ORDER BY name`,
      )
      .all(type) as { name: string }[]
  ).map((r) => r.name);
}

// docs/architecture.md §5: migrations applied at startup; tests run real migrations.
describe('migrations', () => {
  it('create every engine.md §3 table and index on a fresh database', () => {
    const { sqlite } = freshDb();
    expect(objects(sqlite, 'table')).toEqual(TABLES);
    expect(objects(sqlite, 'index')).toEqual([
      'level_progress_mastered_idx',
      'level_progress_track_idx',
      'plan_blocks_day_slot_uq',
      'session_steps_session_ordinal_uq',
      'sessions_level_idx',
      'sessions_started_at_idx',
      'step_progress_due_on_idx',
      'step_progress_level_idx',
      'step_progress_level_step_uq',
      'xp_ledger_day_idx',
    ]);
  });

  it('re-running is a no-op', () => {
    const { sqlite, db, repos } = freshDb();
    repos.profile.create({ name: 'Harry', timezone: 'UTC', now: 1 });
    const applied = () => sqlite.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get();
    const before = applied();
    expect(() => runMigrations(db, MIGRATIONS)).not.toThrow();
    expect(() => runMigrations(db, MIGRATIONS)).not.toThrow();
    expect(applied()).toEqual(before);
    expect(objects(sqlite, 'table')).toEqual(TABLES);
    expect(repos.profile.get()?.name).toBe('Harry');
  });

  it('enables foreign keys; memory databases skip WAL', () => {
    const { sqlite } = freshDb();
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(sqlite.pragma('journal_mode', { simple: true })).toBe('memory');
  });

  it('schema row types match the core port row types', () => {
    expectTypeOf<typeof schema.profile.$inferSelect>().toEqualTypeOf<ProfileRow>();
    expectTypeOf<typeof schema.trackSettings.$inferSelect>().toEqualTypeOf<TrackSettingsRow>();
    expectTypeOf<typeof schema.stepProgress.$inferSelect>().toEqualTypeOf<StepProgressRow>();
    expectTypeOf<typeof schema.levelProgress.$inferSelect>().toEqualTypeOf<LevelProgressRow>();
    expectTypeOf<typeof schema.sessions.$inferSelect>().toEqualTypeOf<SessionRow>();
    expectTypeOf<typeof schema.sessionSteps.$inferSelect>().toEqualTypeOf<SessionStepRow>();
    expectTypeOf<typeof schema.xpLedger.$inferSelect>().toEqualTypeOf<XpLedgerRow>();
    expectTypeOf<typeof schema.dayLog.$inferSelect>().toEqualTypeOf<DayLogRow>();
    expectTypeOf<typeof schema.dailyPlans.$inferSelect>().toEqualTypeOf<DailyPlanRow>();
    expectTypeOf<typeof schema.planBlocks.$inferSelect>().toEqualTypeOf<PlanBlockRow>();
  });
});
