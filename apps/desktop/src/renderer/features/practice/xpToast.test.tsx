import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { practiceSessionFixture } from './dev';
import { usePracticeSession, XP_TOAST_MS, type PracticeIo } from './usePracticeSession';

// The hook module also exports the live IPC wiring; the test passes its own fake `io`.
vi.mock('../../lib/api', () => ({ api: {}, queryKey: (c: string) => [c] }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function io(xpAwarded: number): PracticeIo & { recordStep: ReturnType<typeof vi.fn> } {
  return {
    recordStep: vi.fn(() =>
      Promise.resolve({ xpAwarded, xpTotal: 1245, dueOn: null, intervalDays: 1 }),
    ),
    setVisibility: () => undefined,
    finish: () => Promise.reject(new Error('unused')),
  };
}

// Task 09: live "+5 XP" toast per recorded step (engine.md §4 XpService STEP = 5), 1.2 s.
describe('usePracticeSession xpToast', () => {
  it('shows the awarded XP after recordStep resolves, then clears after 1.2 s', async () => {
    vi.useFakeTimers();
    const fake = io(5);
    const session = practiceSessionFixture({ done: [], vis: 'all' });
    const { result } = renderHook(() =>
      usePracticeSession(session, fake, { onFinished: () => undefined }),
    );
    expect(result.current.xpToast).toBeNull();

    await act(async () => {
      result.current.markPlayed();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fake.recordStep).toHaveBeenCalledTimes(1);
    expect(result.current.xpToast).toEqual({ id: 1, amount: 5 });

    act(() => {
      vi.advanceTimersByTime(XP_TOAST_MS - 1);
    });
    expect(result.current.xpToast).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.xpToast).toBeNull();
  });

  it('shows nothing when the step earned no XP (skipped: engine.md §6.2)', async () => {
    const fake = io(0);
    const session = practiceSessionFixture({ done: [], vis: 'all' });
    const { result } = renderHook(() =>
      usePracticeSession(session, fake, { onFinished: () => undefined }),
    );
    await act(async () => {
      result.current.markPlayed();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fake.recordStep).toHaveBeenCalledTimes(1);
    expect(result.current.xpToast).toBeNull();
  });
});
