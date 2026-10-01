import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { practiceSessionFixture } from './dev';
import { FLASH_MS, initialPracticeState } from './practiceReducer';
import { PracticeView } from './PracticeView';
import {
  AUTO_FINISH_MS,
  usePracticeSession,
  type CompleteDto,
  type PracticeIo,
} from './usePracticeSession';

// decisions.md 2026-10-01 "Hands-free key loop": with the profile's autoContinue on, the key
// finishes by itself AUTO_FINISH_MS after the last chord, through the same path as the button.

vi.mock('../../lib/api', () => ({ api: {}, queryKey: (c: string) => [c] }));

const DTO = { sessionId: 'dev-practice' } as CompleteDto;

function fakeIo(finish: PracticeIo['finish'] = () => Promise.resolve(DTO)) {
  return {
    recordStep: vi.fn(() => Promise.resolve({ xpAwarded: 5 })),
    setVisibility: () => undefined,
    finish: vi.fn(finish),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Six chords done; resolve the seventh and let the 600 ms flash run out. */
async function playLastChord(result: { current: ReturnType<typeof usePracticeSession> }) {
  await act(async () => {
    result.current.markPlayed();
    await vi.advanceTimersByTimeAsync(FLASH_MS);
  });
  expect(result.current.state.phase).toBe('finished');
}

describe('usePracticeSession autoFinish', () => {
  it('finishes the key ~1.2 s after the last chord resolves', async () => {
    const io = fakeIo();
    const onFinished = vi.fn();
    const session = practiceSessionFixture({ done: [0, 1, 2, 3, 4, 5], vis: 'all' });
    const { result } = renderHook(() =>
      usePracticeSession(session, io, { onFinished, autoFinish: true }),
    );
    await playLastChord(result);
    expect(result.current.autoFinishing).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_FINISH_MS - 1);
    });
    expect(io.finish).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(io.finish).toHaveBeenCalledTimes(1);
    expect(io.finish).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'dev-practice' }));
    expect(onFinished).toHaveBeenCalledWith(DTO);
    expect(io.recordStep).toHaveBeenCalledTimes(1);
  });

  it('stays on the finished state when autoFinish is off (today’s behaviour)', async () => {
    const io = fakeIo();
    const session = practiceSessionFixture({ done: [0, 1, 2, 3, 4, 5], vis: 'all' });
    const { result } = renderHook(() =>
      usePracticeSession(session, io, { onFinished: () => undefined, autoFinish: false }),
    );
    await playLastChord(result);
    expect(result.current.autoFinishing).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_FINISH_MS * 5);
    });
    expect(io.finish).not.toHaveBeenCalled();
  });

  it('turning it off before the timer fires cancels the auto-finish', async () => {
    const io = fakeIo();
    const session = practiceSessionFixture({ done: [0, 1, 2, 3, 4, 5], vis: 'all' });
    const { result, rerender } = renderHook(
      ({ auto }: { auto: boolean }) =>
        usePracticeSession(session, io, { onFinished: () => undefined, autoFinish: auto }),
      { initialProps: { auto: true } },
    );
    await playLastChord(result);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_FINISH_MS / 2);
    });
    rerender({ auto: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_FINISH_MS * 5);
    });
    expect(io.finish).not.toHaveBeenCalled();
  });

  it('a failed auto-finish shows the error once and waits for the button', async () => {
    const io = fakeIo(() => Promise.reject(new Error('disk full')));
    const session = practiceSessionFixture({ done: [0, 1, 2, 3, 4, 5, 6], vis: 'all' });
    const { result } = renderHook(() =>
      usePracticeSession(session, io, { onFinished: () => undefined, autoFinish: true }),
    );
    expect(result.current.state.phase).toBe('finished');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_FINISH_MS);
    });
    expect(io.finish).toHaveBeenCalledTimes(1);
    expect(result.current.finishError).not.toBeNull();
    expect(result.current.autoFinishing).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_FINISH_MS * 5);
    });
    expect(io.finish).toHaveBeenCalledTimes(1);
  });
});

describe('PracticeView finished state', () => {
  const finished = initialPracticeState(
    practiceSessionFixture({ done: [0, 1, 2, 3, 4, 5, 6], vis: 'all' }),
  );
  const view = (autoFinishing: boolean) =>
    render(
      <MemoryRouter>
        <PracticeView
          state={finished}
          title="A major"
          eyebrow={{ text: 'Learn', tone: 'tangerine' }}
          midiStatus={{ kind: 'no-device' }}
          markPlayed="hidden"
          onHint={() => undefined}
          onSkip={() => undefined}
          onMarkPlayed={() => undefined}
          onVisibility={() => undefined}
          onFinish={() => undefined}
          headerMidiStatus={{ kind: 'no-device' }}
          autoFinishing={autoFinishing}
        />
      </MemoryRouter>,
    );

  it('keeps "Finish the key" and adds a "Finishing…" hint while auto-finishing', () => {
    view(true);
    expect(screen.getByTestId('finish-key').textContent).toBe('Finish the key');
    expect(screen.getByTestId('auto-finish-hint').textContent).toBe('Finishing…');
  });

  it('no hint when auto-finish is off', () => {
    view(false);
    expect(screen.getByTestId('finish-key')).toBeTruthy();
    expect(screen.queryByTestId('auto-finish-hint')).toBeNull();
  });
});
