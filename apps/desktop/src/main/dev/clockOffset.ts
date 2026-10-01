import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * e2e only: `dev.seed({scenario:'advance-day'})` moves the SystemClock forward. The offset is
 * persisted beside the DB so a relaunch with the same userData still sees the moved "today".
 */
export const CLOCK_OFFSET_FILE = 'clock-offset.json';

export function clockOffsetPath(userData: string): string {
  return join(userData, CLOCK_OFFSET_FILE);
}

/** 0 when the file is missing or unreadable. */
export function loadClockOffset(userData: string): number {
  try {
    const raw: unknown = JSON.parse(readFileSync(clockOffsetPath(userData), 'utf8'));
    const offset = (raw as { offsetMs?: unknown } | null)?.offsetMs;
    return typeof offset === 'number' && Number.isFinite(offset) ? offset : 0;
  } catch {
    return 0;
  }
}

export function saveClockOffset(userData: string, offsetMs: number): void {
  writeFileSync(clockOffsetPath(userData), `${JSON.stringify({ offsetMs })}\n`, 'utf8');
}
