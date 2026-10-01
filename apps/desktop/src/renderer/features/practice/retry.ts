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

/**
 * Task 16 offline post queue (in memory). Each post runs with backoff; a post that still fails
 * is parked under its key and re-sent on the next action (the next `post()`), and once more by
 * `flush()` before the session finishes. Nothing is surfaced to the learner unless `flush()`
 * still has parked posts, and then only as a calm "Try again" line.
 */
export class PostQueue<K extends string | number> {
  private readonly inflight = new Set<Promise<unknown>>();
  private readonly parked = new Map<K, () => Promise<unknown>>();

  constructor(
    private readonly delays: readonly number[] = RETRY_DELAYS_MS,
    private readonly wait: (ms: number) => Promise<void> = sleep,
  ) {}

  /**
   * Send `fn` (after `after`, if given) and retry parked posts alongside it. Resolves with the
   * result, or `undefined` when the post was parked. Never rejects.
   */
  post<T>(key: K, fn: () => Promise<T>, after?: Promise<unknown>): Promise<T | undefined> {
    this.retryParked();
    return this.track(key, fn, this.delays, after);
  }

  /** Re-send every parked post now (fire and forget). */
  retryParked(delays: readonly number[] = this.delays): void {
    for (const [key, fn] of [...this.parked]) {
      this.parked.delete(key);
      void this.track(key, fn, delays);
    }
  }

  /** Wait for in-flight posts, retry parked ones once, and return the keys still failing. */
  async flush(delays: readonly number[] = [500]): Promise<K[]> {
    await this.settle();
    this.retryParked(delays);
    await this.settle();
    return [...this.parked.keys()];
  }

  /** The promise for every post in flight right now (resolves when they all settle). */
  settle(): Promise<void> {
    return Promise.all([...this.inflight]).then(() => undefined);
  }

  get parkedKeys(): K[] {
    return [...this.parked.keys()];
  }

  private track<T>(
    key: K,
    fn: () => Promise<T>,
    delays: readonly number[],
    after?: Promise<unknown>,
  ): Promise<T | undefined> {
    const run = (after ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => withRetry(fn, delays, this.wait))
      .then(
        (result) => {
          this.parked.delete(key);
          return result;
        },
        () => {
          this.parked.set(key, fn);
          return undefined;
        },
      );
    this.inflight.add(run);
    void run.finally(() => this.inflight.delete(run));
    return run;
  }
}
