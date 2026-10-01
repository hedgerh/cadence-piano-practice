// docs/engine.md §5 Practice — the effects around the pure practiceReducer: MIDI → HELD_CHANGED,
// the 600 ms teal flash, recordStep posts (with a small in-memory retry), the optimistic
// visibility mutation, resume via sessions.get, and "Finish the key" → sessions.finish.
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ChannelInput, ChannelOutput } from '@shared/ipc/contracts';
import { api, queryKey } from '../../lib/api';
import { useHeldNotes } from '../../midi/hooks';
import { withRetry } from './retry';
import { useInvalidateProgress, useSetTrackSettings } from '../shared/hooks';
import {
  durationMs,
  FLASH_MS,
  initialPracticeState,
  practiceReducer,
  type PracticeSession,
  type PracticeState,
  type Resolution,
  type Visibility,
} from './practiceReducer';

export type CompleteDto = ChannelOutput<'sessions.finish'>;

/** Router `state` for `/complete/:sessionId` (Task 09 reads `complete`). */
export interface CompleteRouteState {
  complete: CompleteDto;
}

/** The side effects the practice machine needs; the dev screen passes no-op fakes. */
export interface PracticeIo {
  recordStep: (input: ChannelInput<'sessions.recordStep'>) => Promise<unknown>;
  setVisibility: (trackId: string, visibility: Visibility) => void;
  finish: (input: ChannelInput<'sessions.finish'>) => Promise<CompleteDto>;
}

/** A ref that always holds the latest value (updated after render, read in callbacks). */
function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Task 09: the live "+5 XP" toast after a step is recorded (small, bottom-right, 1.2 s). */
export const XP_TOAST_MS = 1200;

export interface XpToast {
  /** Increments per toast so the view restarts its animation. */
  id: number;
  amount: number;
}

/** `sessions.recordStep` → `xpAwarded` (the dev screen's fake returns nothing). */
function xpAwardedOf(result: unknown): number {
  if (typeof result !== 'object' || result === null || !('xpAwarded' in result)) return 0;
  const xp = result.xpAwarded;
  return typeof xp === 'number' ? xp : 0;
}

export interface PracticeSessionApi {
  state: PracticeState;
  xpToast: XpToast | null;
  hint: () => void;
  skip: () => void;
  markPlayed: () => void;
  setVisibility: (vis: Visibility) => void;
  finish: () => void;
  finishing: boolean;
  finishError: string | null;
}

export function usePracticeSession(
  session: PracticeSession,
  io: PracticeIo,
  opts: {
    onFinished: (dto: CompleteDto) => void;
    /** Start from this state instead of `initialPracticeState(session)` (dev fixtures). */
    initial?: PracticeState;
  },
): PracticeSessionApi {
  const initial = opts.initial;
  const [state, dispatch] = useReducer(
    practiceReducer,
    session,
    (s) => initial ?? initialPracticeState(s),
  );
  const stateRef = useLatest(state);
  const ioRef = useLatest(io);
  const onFinishedRef = useLatest(opts.onFinished);

  // MIDI subscription: every change of the held set (any input) → HELD_CHANGED.
  const held = useHeldNotes();
  useEffect(() => {
    dispatch({ type: 'HELD_CHANGED', held, at: Date.now() });
  }, [held]);

  // engine.md §6.6: matched (teal) → 600 ms → advancing → next step.
  const resolvedCount = state.results.length;
  useEffect(() => {
    if (state.phase !== 'matched') return;
    const t = setTimeout(() => dispatch({ type: 'FLASH_DONE' }), FLASH_MS);
    return () => clearTimeout(t);
  }, [state.phase, resolvedCount]);
  useEffect(() => {
    if (state.phase === 'advancing') dispatch({ type: 'ADVANCE', at: Date.now() });
  }, [state.phase]);

  // recordStep: post each new resolution once (idempotent on ordinal), retrying in memory.
  const posted = useRef<Set<number>>(new Set(session.results.map((r) => r.ordinal)));
  const inflight = useRef<Set<Promise<void>>>(new Set());
  const failed = useRef<Map<number, Resolution>>(new Map());
  const sessionId = session.sessionId;
  const [xpToast, setXpToast] = useState<XpToast | null>(null);
  const toastSeq = useRef(0);
  const post = useCallback(
    (r: Resolution, delays?: readonly number[]): Promise<void> =>
      withRetry(() => ioRef.current.recordStep({ sessionId, ...r }), delays).then(
        (res) => {
          failed.current.delete(r.ordinal);
          const amount = xpAwardedOf(res);
          if (amount > 0) setXpToast({ id: ++toastSeq.current, amount });
        },
        () => void failed.current.set(r.ordinal, r),
      ),
    [sessionId, ioRef],
  );
  useEffect(() => {
    if (xpToast === null) return;
    const t = setTimeout(() => setXpToast(null), XP_TOAST_MS);
    return () => clearTimeout(t);
  }, [xpToast]);
  useEffect(() => {
    for (const r of state.results) {
      if (posted.current.has(r.ordinal)) continue;
      posted.current.add(r.ordinal);
      const p = post(r).finally(() => inflight.current.delete(p));
      inflight.current.add(p);
    }
  }, [state.results, post]);

  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const finish = useCallback(() => {
    if (stateRef.current.phase !== 'finished') return;
    setFinishing(true);
    setFinishError(null);
    void (async () => {
      try {
        await Promise.all([...inflight.current]);
        for (const r of [...failed.current.values()]) await post(r, [500]);
        if (failed.current.size > 0) throw new Error('recordStep failed');
        const dto = await ioRef.current.finish({
          sessionId,
          durationMs: durationMs(stateRef.current, Date.now()),
        });
        onFinishedRef.current(dto);
      } catch {
        setFinishError('Couldn’t save this practice. Try again.');
      } finally {
        setFinishing(false);
      }
    })();
  }, [post, sessionId, stateRef, ioRef, onFinishedRef]);

  const trackId = session.trackId;
  const setVisibility = useCallback(
    (vis: Visibility) => {
      dispatch({ type: 'SET_VIS', vis });
      ioRef.current.setVisibility(trackId, vis);
    },
    [trackId, ioRef],
  );

  return {
    state,
    xpToast,
    hint: useCallback(() => dispatch({ type: 'HINT', at: Date.now() }), []),
    skip: useCallback(() => dispatch({ type: 'SKIP', at: Date.now() }), []),
    markPlayed: useCallback(() => dispatch({ type: 'MARK_PLAYED', at: Date.now() }), []),
    setVisibility,
    finish,
    finishing,
    finishError,
  };
}

/** The real IPC side effects; visibility updates the overview cache optimistically. */
export function useLivePracticeIo(): PracticeIo {
  const qc = useQueryClient();
  const { mutate: saveSettings } = useSetTrackSettings();
  const saveRef = useLatest(saveSettings);
  // Task 09: XP/streak (header pills), plan and overviews refresh after every recorded step.
  const invalidateRef = useLatest(useInvalidateProgress());
  return useMemo<PracticeIo>(
    () => ({
      recordStep: async (input) => {
        const result = await api['sessions.recordStep'](input);
        void invalidateRef.current();
        return result;
      },
      setVisibility: (trackId, visibility) => {
        qc.setQueryData<ChannelOutput<'tracks.overview'>>(
          queryKey('tracks.overview', { trackId }),
          (old) => (old ? { ...old, visibility } : old),
        );
        saveRef.current({ trackId, visibility });
      },
      finish: (input) => api['sessions.finish'](input),
    }),
    [qc, saveRef, invalidateRef],
  );
}

/**
 * Loads the session for `/practice/:levelId`: `?session=` → `sessions.get` (resume);
 * otherwise `sessions.start` (which itself resumes today's unfinished session for the level),
 * using `?block=` or today's open block for the level, then writes `?session=` into the URL so
 * a reload resumes at the same chord.
 */
export function usePracticeLoader(levelId: string | undefined): {
  session: PracticeSession | null;
  error: string | null;
} {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('session');
  const blockId = params.get('block');
  const qc = useQueryClient();
  const invalidateRef = useLatest(useInvalidateProgress());
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    if (levelId === undefined) return;
    if (sessionId !== null && loadedId.current === sessionId) return;
    let cancelled = false;
    const load = async (): Promise<PracticeSession> => {
      if (sessionId !== null) return api['sessions.get']({ sessionId });
      let block: ChannelOutput<'plan.getToday'>['blocks'][number] | undefined;
      try {
        const today = await qc.fetchQuery({
          queryKey: queryKey('plan.getToday'),
          queryFn: () => api['plan.getToday'](),
        });
        block = today.blocks.find((b) =>
          blockId !== null
            ? b.id === blockId && b.levelId === levelId
            : b.levelId === levelId && b.status !== 'done',
        );
      } catch {
        block = undefined;
      }
      const started = await api['sessions.start']({
        levelId,
        kind: block?.kind ?? 'learn',
        ...(block ? { planBlockId: block.id } : {}),
      });
      void invalidateRef.current();
      return started;
    };
    load().then(
      (s) => {
        if (cancelled) return;
        loadedId.current = s.sessionId;
        setSession(s);
        setError(null);
        if (sessionId === null) {
          setParams(
            (p) => {
              const next = new URLSearchParams(p);
              next.set('session', s.sessionId);
              next.delete('block');
              return next;
            },
            { replace: true },
          );
        }
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [levelId, sessionId, blockId, qc, setParams, invalidateRef]);

  return { session, error };
}
