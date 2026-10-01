// decisions.md 2026-10-01 "Hands-free key loop": on Complete, "Keep going" runs by itself after a
// short countdown (when the profile's `autoContinue` is on) or on any MIDI note-on (always), so
// the learner can cycle through the keys without leaving the piano.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMidiEvents } from '../../midi/hooks';
import type { NextAction } from './complete';

/** "Next: E major in 3…" counts 3 → 1, then continues (about 3 s in all). */
export const COUNTDOWN_SECONDS = 3;
export const COUNTDOWN_TICK_MS = 1000;

/** Runs `fn` after `ms`; returns a cancel. Injected so tests and the dev screen control time. */
export type Schedule = (fn: () => void, ms: number) => () => void;

export const realSchedule: Schedule = (fn, ms) => {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
};

/** Never fires: the dev screen's frozen "in 3…" (deterministic screenshots). */
export const frozenSchedule: Schedule = () => () => undefined;

export interface HandsFreeNext {
  /** Seconds left while the countdown runs (3, 2, 1); null when it is not running. */
  remaining: number | null;
  /** "Stay here": cancel the countdown for this screen. */
  stay: () => void;
}

export function useHandsFreeNext(opts: {
  /** The automatable "Keep going" (completeView's `autoNext`), or null for nothing at all. */
  next: NextAction | null;
  autoContinue: boolean;
  /** A start is in flight (from a click or from us): never count or fire meanwhile. */
  busy: boolean;
  onContinue: (action: NextAction) => void;
  schedule?: Schedule;
}): HandsFreeNext {
  const { next, autoContinue, busy, onContinue, schedule = realSchedule } = opts;
  const [stayed, setStayed] = useState(false);
  // One automatic continue per screen; a failed start is retried with the button.
  const [fired, setFired] = useState(false);
  const firedRef = useRef(false);
  const onContinueRef = useRef(onContinue);
  useEffect(() => {
    onContinueRef.current = onContinue;
  });

  const go = useCallback(() => {
    if (next === null || firedRef.current) return;
    firedRef.current = true;
    setFired(true);
    onContinueRef.current(next);
  }, [next]);

  const counting = next !== null && autoContinue && !stayed && !busy && !fired;
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  // Restart from 3 whenever the countdown (re)starts, e.g. the toggle is switched back on.
  const [wasCounting, setWasCounting] = useState(counting);
  if (wasCounting !== counting) {
    setWasCounting(counting);
    if (counting) setRemaining(COUNTDOWN_SECONDS);
  }

  useEffect(() => {
    if (!counting) return;
    return schedule(() => {
      if (remaining <= 1) go();
      else setRemaining(remaining - 1);
    }, COUNTDOWN_TICK_MS);
  }, [counting, remaining, schedule, go]);

  // Any key on the piano keeps going, whatever the setting (note-offs of the last chord don't).
  useMidiEvents((e) => {
    if (e.type === 'on' && !busy) go();
  });

  return { remaining: counting ? remaining : null, stay: useCallback(() => setStayed(true), []) };
}
