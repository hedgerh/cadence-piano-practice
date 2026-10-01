import { describe, expect, it } from 'vitest';
import { PostQueue, withRetry } from './retry';

// engine.md §5 "recordStep posts with retry"; Task 16: offline posts are parked in memory and
// retried on the next action, never surfacing an error until Finish still cannot save.

const noWait = () => Promise.resolve();

/** A post that fails `failures` times, then succeeds with `value`. */
function flaky<T>(failures: number, value: T) {
  let calls = 0;
  const fn = () => {
    calls++;
    return calls <= failures ? Promise.reject(new Error('offline')) : Promise.resolve(value);
  };
  return { fn, calls: () => calls };
}

describe('withRetry', () => {
  it('retries after each delay, then rethrows the last error', async () => {
    const waits: number[] = [];
    const wait = (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    };
    const ok = flaky(2, 'saved');
    await expect(withRetry(ok.fn, [1, 2, 3], wait)).resolves.toBe('saved');
    expect(waits).toEqual([1, 2]);
    const never = flaky(99, 'x');
    await expect(withRetry(never.fn, [1], wait)).rejects.toThrow('offline');
    expect(never.calls()).toBe(2);
  });
});

describe('PostQueue', () => {
  it('returns the result of a post that succeeds', async () => {
    const q = new PostQueue<number>([0], noWait);
    await expect(q.post(1, () => Promise.resolve({ xpAwarded: 5 }))).resolves.toEqual({
      xpAwarded: 5,
    });
    expect(q.parkedKeys).toEqual([]);
  });

  it('parks a post that keeps failing (resolves undefined, never rejects)', async () => {
    const q = new PostQueue<number>([0, 0], noWait);
    const step = flaky(10, 'saved');
    await expect(q.post(3, step.fn)).resolves.toBeUndefined();
    expect(step.calls()).toBe(3);
    expect(q.parkedKeys).toEqual([3]);
  });

  it('re-sends parked posts on the next action', async () => {
    const q = new PostQueue<number>([], noWait);
    const first = flaky(1, 'first');
    await q.post(0, first.fn);
    expect(q.parkedKeys).toEqual([0]);
    await q.post(1, () => Promise.resolve('second'));
    await q.settle();
    expect(first.calls()).toBe(2);
    expect(q.parkedKeys).toEqual([]);
  });

  it('flush waits for in-flight posts, retries parked ones once, and reports what still fails', async () => {
    const q = new PostQueue<string>([], noWait);
    const recovers = flaky(1, 'ok');
    const dead = flaky(99, 'never');
    await q.post('playback:0', dead.fn);
    await q.post('step:0', recovers.fn);
    await q.settle();
    // The second post re-sent the parked play-back (still failing); step:0 is now parked too.
    expect(q.parkedKeys.sort()).toEqual(['playback:0', 'step:0']);
    await expect(q.flush([])).resolves.toEqual(['playback:0']);
    expect(recovers.calls()).toBe(2);
    expect(dead.calls()).toBe(3);
  });

  it('runs a post after the promise it depends on (play-back after its answer)', async () => {
    const q = new PostQueue<string>([], noWait);
    const order: string[] = [];
    let release: () => void = () => undefined;
    const step = new Promise<void>((resolve) => {
      release = resolve;
    }).then(() => order.push('step'));
    const playback = q.post(
      'playback:2',
      () => {
        order.push('playback');
        return Promise.resolve();
      },
      step,
    );
    release();
    await playback;
    expect(order).toEqual(['step', 'playback']);
  });
});
