import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

export interface OpenedDatabase {
  sqlite: Database.Database;
  db: Db;
}

/**
 * Opens (or creates) the SQLite database at `path`, or an in-memory one for `':memory:'`.
 * File databases use WAL; every connection enforces foreign keys.
 */
export function openDatabase(path: string): OpenedDatabase {
  const sqlite = new Database(path);
  if (path !== ':memory:') sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}
