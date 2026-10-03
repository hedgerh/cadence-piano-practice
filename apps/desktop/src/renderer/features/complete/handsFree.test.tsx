import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeMidiInput } from '../../midi/FakeMidiInput';
import { MidiHubContext } from '../../midi/hooks';
import { createMidiHub } from '../../midi/midiStore';
import { completeView } from './complete';
import { CompleteView, type CompleteViewProps } from './CompleteView';
import { circleRunFixture, completeDtoFixture } from './dev';
import { COUNTDOWN_TICK_MS } from './useHandsFreeNext';

// decisions.md 2026-10-01 "Hands-free key loop": Complete counts down to "Keep going" when the
// profile's autoContinue is on, and any MIDI note-on keeps going regardless of the setting.

const NEXT = {
  kind: 'next',
  label: 'Keep going — E major',
  levelId: 'e-major',
  run: null,
} as const;

let device: FakeMidiInput;
let hub: ReturnType<typeof createMidiHub>;

beforeEach(() => {
  vi.useFakeTimers();
  hub = createMidiHub();
  device = new FakeMidiInput();
  hub.attach(device, 'device');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function wrap(node: ReactNode) {
  return (
    <MidiHubContext.Provider value={hub}>
      <MemoryRouter>{node}</MemoryRouter>
    </MidiHubContext.Provider>
  );
}

function renderView(props: Partial<CompleteViewProps> = {}) {
  const onAction = vi.fn();
  const all: CompleteViewProps = { complete: completeDtoFixture(), onAction, ...props };
  const r = render(wrap(<CompleteView {...all} />));
  return {
    onAction,
    rerender: (p: Partial<CompleteViewProps>) => r.rerender(wrap(<CompleteView {...all} {...p} />)),
  };
}

const tick = (n = 1) =>
  act(() => {
    vi.advanceTimersByTime(COUNTDOWN_TICK_MS * n);
  });

const countdown = () => screen.queryByTestId('complete-countdown')?.textContent ?? null;

describe('completeView autoNext', () => {
  it('is the "Keep going" action for a clean pass with a next key', () => {
    expect(completeView(completeDtoFixture()).autoNext).toEqual({ action: NEXT, title: 'E major' });
  });

  it('is null with skips, at the end of the circle, or for an ear drill', () => {
    expect(completeView(completeDtoFixture([1, 4])).autoNext).toBeNull();
    expect(completeView({ ...completeDtoFixture(), next: null }).autoNext).toBeNull();
    expect(completeView({ ...completeDtoFixture(), isEar: true }).autoNext).toBeNull();
  });
});

describe('CompleteView hands-free countdown', () => {
  it('counts 3 → 1 then runs the same "Keep going" action (about 3 s)', () => {
    const { onAction } = renderView({ autoContinue: true });
    expect(countdown()).toBe('Next: E major in 3…');
    tick();
    expect(countdown()).toBe('Next: E major in 2…');
    tick();
    expect(countdown()).toBe('Next: E major in 1…');
    expect(onAction).not.toHaveBeenCalled();
    tick();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(NEXT);
    expect(countdown()).toBeNull();
    tick(5);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('in a circle run the countdown keeps the run going (decisions.md 2026-10-03)', () => {
    const { onAction } = renderView({ autoContinue: true, complete: circleRunFixture('mid') });
    tick();
    tick();
    tick();
    expect(onAction).toHaveBeenCalledWith({ ...NEXT, run: 'circle' });
  });

  it('"Stay here" cancels the countdown for this screen', () => {
    const { onAction } = renderView({ autoContinue: true });
    tick();
    fireEvent.click(screen.getByTestId('complete-stay'));
    expect(countdown()).toBeNull();
    expect(screen.queryByTestId('complete-stay')).toBeNull();
    tick(10);
    expect(onAction).not.toHaveBeenCalled();
    // The buttons still work.
    fireEvent.click(screen.getByTestId('complete-next'));
    expect(onAction).toHaveBeenCalledWith(NEXT);
  });

  it('shows no countdown when autoContinue is off; switching it on starts from 3', () => {
    const { onAction, rerender } = renderView({ autoContinue: false });
    expect(countdown()).toBeNull();
    tick(10);
    expect(onAction).not.toHaveBeenCalled();
    rerender({ autoContinue: true });
    expect(countdown()).toBe('Next: E major in 3…');
    tick();
    rerender({ autoContinue: false });
    expect(countdown()).toBeNull();
    rerender({ autoContinue: true });
    expect(countdown()).toBe('Next: E major in 3…');
  });

  it('pauses while a start is in flight', () => {
    const { onAction } = renderView({ autoContinue: true, busy: true });
    expect(countdown()).toBeNull();
    tick(10);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('the toggle reports the new value', () => {
    const onAutoContinueChange = vi.fn();
    renderView({ autoContinue: true, onAutoContinueChange });
    const toggle = screen.getByTestId<HTMLInputElement>('complete-auto-toggle');
    expect(toggle.checked).toBe(true);
    expect(screen.getByLabelText('Keep going automatically')).toBe(toggle);
    fireEvent.click(toggle);
    expect(onAutoContinueChange).toHaveBeenCalledWith(false);
  });
});

describe('CompleteView MIDI continue', () => {
  it('any note-on keeps going immediately, with the setting off', () => {
    const { onAction } = renderView({ autoContinue: false });
    expect(screen.getByTestId('complete-midi-caption').textContent).toBe(
      'Play any key to keep going.',
    );
    act(() => device.press(60));
    act(() => device.press(64));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(NEXT);
  });

  it('a note-off (the last chord let go) does not', () => {
    device.press(57);
    const { onAction } = renderView({ autoContinue: false });
    act(() => device.release(57));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('a note-on during the countdown continues at once, and only once', () => {
    const { onAction } = renderView({ autoContinue: true });
    tick();
    act(() => device.press(60));
    expect(onAction).toHaveBeenCalledTimes(1);
    tick(5);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('nothing extra (no countdown, caption, toggle or MIDI continue) with skips or no next key', () => {
    for (const complete of [
      completeDtoFixture([1, 4]),
      { ...completeDtoFixture(), next: null },
      { ...completeDtoFixture(), isEar: true },
    ]) {
      const { onAction } = renderView({ complete, autoContinue: true });
      expect(screen.queryByTestId('complete-hands-free')).toBeNull();
      act(() => device.press(60));
      act(() => device.release(60));
      tick(5);
      expect(onAction).not.toHaveBeenCalled();
      cleanup();
    }
  });
});
