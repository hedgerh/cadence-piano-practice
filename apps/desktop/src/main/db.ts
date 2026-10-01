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

/** Open (WAL, foreign keys on) and migrate. architecture.md §4 step 3. */
export function openAppDatabase(
  path = databasePath(),
  migrations = migrationsFolder(),
): OpenedDatabase {
  const opened = openDatabase(path);
  try {
    runMigrations(opened.db, migrations);
  } catch (err) {
    opened.sqlite.close();
    throw err;
  }
  return opened;
}
