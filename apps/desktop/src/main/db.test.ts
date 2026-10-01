import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openAppDatabase } from './db';

// architecture.md §4 step 3: open + migrate at startup; the count is logged so a packaged
// first launch shows migrations ran and a relaunch shows none.
const MIGRATIONS = resolve(__dirname, '../../../../packages/db/drizzle');

describe('openAppDatabase', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('applies every migration on first open and none on reopen', () => {
    dir = mkdtempSync(join(tmpdir(), 'cadence-db-'));
    const file = join(dir, 'cadence.sqlite');

    const first = openAppDatabase(file, MIGRATIONS);
    expect(first.migrations.applied).toBeGreaterThan(0);
    expect(first.migrations.applied).toBe(first.migrations.total);
    first.sqlite.close();

    const second = openAppDatabase(file, MIGRATIONS);
    expect(second.migrations).toEqual({ applied: 0, total: first.migrations.total });
    second.sqlite.close();
  });
});
