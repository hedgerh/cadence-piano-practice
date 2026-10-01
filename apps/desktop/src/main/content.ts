import { type Track, type ValidationError, buildTracks, validateTracks } from '@cadence/content';

export interface ContentLogger {
  error(...args: unknown[]): void;
}

/**
 * architecture.md §4 step 4: build every track from the generators and validate it. A broken
 * generator throws in dev (`strict`) so it is caught immediately; a packaged build logs the
 * problems and keeps running rather than refusing to start.
 */
export function loadContent(strict: boolean, logger: ContentLogger): Track[] {
  const tracks = buildTracks();
  const errors = validateTracks(tracks);
  if (errors.length > 0) {
    const report = formatErrors(errors);
    if (strict) throw new Error(`Content validation failed:\n${report}`);
    logger.error(`Content validation found ${errors.length} problem(s):\n${report}`);
  }
  return tracks;
}

function formatErrors(errors: readonly ValidationError[]): string {
  return errors.map((e) => `  ${e.path}: ${e.message}`).join('\n');
}
