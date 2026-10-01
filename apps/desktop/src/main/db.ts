import { join, resolve } from 'node:path';
import { app } from 'electron';
import { openDatabase, runMigrations, type OpenedDatabase } from '@cadence/db';

export const DB_FILE = 'cadence.sqlite';

/** `userData/cadence.sqlite` (userData honours CADENCE_USER_DATA, set in index.ts). */
export function databasePath(): string {
  return join(app.getPath('userData'), DB_FILE);
}

/**
 * Drizzle migrations folder. Packaged: shipped by electron-builder `extraResources` to
 * `resources/drizzle`. Unpackaged (dev, e2e): the repo's `packages/db/drizzle`, found from the
 * app path (`apps/desktop`).
 */
export function migrationsFolder(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'drizzle')
    : resolve(app.getAppPath(), '../../packages/db/drizzle');
}

/** Rows in Drizzle's journal table (0 before the first migration creates it). */
export function appliedMigrationCount(sqlite: OpenedDatabase['sqlite']): number {
  const table = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
    .get();
  if (!table) return 0;
  return (sqlite.prepare('SELECT COUNT(*) AS n FROM __drizzle_migrations').get() as { n: number })
    .n;
}

export interface AppDatabase extends OpenedDatabase {
  /** Migrations applied by this open, and the total now recorded (logged at startup). */
  migrations: { applied: number; total: number };
}

/** Open (WAL, foreign keys on) and migrate. architecture.md §4 step 3. */
export function openAppDatabase(
  path = databasePath(),
  migrations = migrationsFolder(),
): AppDatabase {
  const opened = openDatabase(path);
  try {
    const before = appliedMigrationCount(opened.sqlite);
    runMigrations(opened.db, migrations);
    const total = appliedMigrationCount(opened.sqlite);
    return { ...opened, migrations: { applied: total - before, total } };
  } catch (err) {
    opened.sqlite.close();
    throw err;
  }
}
