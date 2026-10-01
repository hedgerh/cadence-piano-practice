// In-memory retry for sessions.recordStep posts (engine.md §5: "recordStep posts with retry").

/** Backoff between attempts of a failed recordStep post (then it waits for Finish). */
export const RETRY_DELAYS_MS: readonly number[] = [250, 1000, 3000];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Run `fn`, retrying after each delay in `delays`; rethrows the last error. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  delays: readonly number[] = RETRY_DELAYS_MS,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const delay = delays[attempt];
      if (delay === undefined) break;
      await wait(delay);
    }
  }
  throw lastError;
}
