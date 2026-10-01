import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from './client';

/**
 * Applies pending migrations from `migrationsFolder` (the generated `packages/db/drizzle`
 * folder, resolved by the caller). Already-applied migrations are skipped.
 */
export function runMigrations(db: Db, migrationsFolder: string): void {
  migrate(db, { migrationsFolder });
}
