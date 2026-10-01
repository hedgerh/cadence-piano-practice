// docs/engine.md §5 Ear — the effects around the pure earReducer: auto-play 300 ms after a
// question appears (the cadence first when its key hasn't been heard yet), answers gated until
// that finishes (§6.10), recordStep on PICK (retried in memory), MIDI play-back detection →
// recordPlayback once per question (§6.11), and sessions.finish after the last question.
import {
  initialMatchState,
  noteToMidi,
  pcNumber,
  reduceMatch,
  type MatchState,
} from '@cadence/music';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ChannelInput, ChannelOutput } from '@shared/ipc/contracts';
import { useAudio } from '../../audio/useAudio';
import { api } from '../../lib/api';
import { useHeldNotes, useMidiEvents } from '../../midi/hooks';
import { withRetry } from '../practice/retry';
import { useInvalidateProgress } from '../shared/hooks';
import { autoPlaySounds, contextId, playbackSpec, soundNotes } from './choiceModel';
import {
  answersEnabled,
  currentQuestion,
  durationMs,
  earReducer,
  initialEarState,
  type EarDrillState,
  type EarQuestion,
  type EarResult,
  type EarSession,
} from './earDrillReducer';

export type CompleteDto = ChannelOutput<'sessions.finish'>;

/** Router `state` for `/ear/results/:sessionId`. */
export interface EarResultsRouteState {
  complete: CompleteDto;
}

/** engine.md §5: auto-play 300 ms after a question appears. */
export const AUTO_PLAY_DELAY_MS = 300;

/** The side effects the ear machine needs; dev screens pass no-op fakes. */
export interface EarIo {
  recordStep: (input: ChannelInput<'sessions.recordStep'>) => Promise<unknown>;
  recordPlayback: (input: ChannelInput<'sessions.recordPlayback'>) => Promise<unknown>;
  finish: (input: ChannelInput<'sessions.finish'>) => Promise<CompleteDto>;
}

export interface EarDrillApi {
  state: EarDrillState;
  question: EarQuestion | undefined;
  enabled: boolean;
  /** A prompt or cadence started from this drill is sounding. */
  playing: boolean;
  /** Main 112px button: the prompt (with the unheard cadence first on a first play). */
  play: () => void;
  /** 72px "Hear the key" button: the cadence. */
  playContext: () => void;
  pick: (option: string) => void;
  next: () => void;
  hint: () => void;
  /** Find the key: play `step.hint` (the phrase's last chord) and mark the question hinted. */
  playHint: () => void;
  finishing: boolean;
  finishError: string | null;
  retryFinish: () => void;
}

/** Keep `p` in `set` until it settles (Finish waits for every in-flight post). */
function trackIn(set: Set<Promise<void>>, p: Promise<void>): Promise<void> {
  set.add(p);
  void p.finally(() => set.delete(p));
  return p;
}

function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

export function useEarDrill(
  session: EarSession,
  io: EarIo,
  opts: {
    onFinished: (dto: CompleteDto) => void;
    /** Start from this state instead of `initialEarState(session)` (dev fixtures). */
    initial?: EarDrillState;
    /** Auto-play each question (default true; dev fixtures switch it off). */
    autoPlay?: boolean;
  },
): EarDrillApi {
  const initial = opts.initial;
  const autoPlay = opts.autoPlay ?? true;
  const [state, dispatch] = useReducer(earReducer, session, (s) => initial ?? initialEarState(s));
  const stateRef = useLatest(state);
  const ioRef = useLatest(io);
  const onFinishedRef = useLatest(opts.onFinished);
  const audio = useAudio();
  const audioRef = useLatest(audio);
  const question = currentQuestion(state);

  // ---------------------------------------------------------------- audio

  /** Cadences already heard in this drill (auto-played once per key). */
  const heard = useRef<Set<string>>(new Set());
  const busy = useRef(false);
  /** Bumped when a question is left: an in-flight sequence stops after its current sound. */
  const generation = useRef(0);

  const runPrompt = useCallback(async () => {
    const s = stateRef.current;
    const q = s.q;
    const target = s.questions[q];
    if (target === undefined || busy.current || s.phase === 'done') return;
    busy.current = true;
    const gen = generation.current;
    dispatch({ type: 'PLAY_START', q, at: Date.now() });
    try {
      // A first play includes the cadence when this key hasn't been heard yet (Task 13).
      const sounds = s.played
        ? target.play
          ? [target.play]
          : []
        : autoPlaySounds(target, heard.current);
      for (const sound of sounds) {
        if (generation.current !== gen) break;
        await audioRef.current.play(sound);
        if (sound === target.context) {
          const id = contextId(target);
          if (id !== null) heard.current.add(id);
        }
      }
    } catch {
      // A failed sound still enables the answers below; the learner can replay.
    } finally {
      busy.current = false;
      dispatch({ type: 'PLAY_END', q, at: Date.now() });
    }
  }, [stateRef, audioRef]);

  const play = useCallback(() => void runPrompt(), [runPrompt]);

  const playContext = useCallback(() => {
    const target = currentQuestion(stateRef.current);
    if (target?.context === undefined || busy.current) return;
    busy.current = true;
    const id = contextId(target);
    void audioRef.current
      .play(target.context)
      .catch(() => undefined)
      .finally(() => {
        busy.current = false;
        if (id !== null) heard.current.add(id);
      });
  }, [stateRef, audioRef]);

  // engine.md §5: auto-play 300 ms after a question appears.
  useEffect(() => {
    if (!autoPlay || state.phase !== 'idle') return;
    const t = setTimeout(() => void runPrompt(), AUTO_PLAY_DELAY_MS);
    return () => clearTimeout(t);
  }, [autoPlay, state.phase, state.q, runPrompt]);

  // Leaving the drill silences it.
  useEffect(
    () => () => {
      generation.current += 1;
      audioRef.current.stop();
    },
    [audioRef],
  );

  // ---------------------------------------------------------------- recordStep / recordPlayback

  const sessionId = session.sessionId;
  const posted = useRef<Set<number>>(new Set(session.results.map((r) => r.ordinal)));
  const stepPosts = useRef<Map<number, Promise<void>>>(new Map());
  const inflight = useRef<Set<Promise<void>>>(new Set());
  const failed = useRef<Map<number, EarResult>>(new Map());

  const postStep = useCallback(
    (r: EarResult, delays?: readonly number[]): Promise<void> =>
      withRetry(
        () =>
          ioRef.current.recordStep({
            sessionId,
            stepId: r.stepId,
            ordinal: r.ordinal,
            result: r.result,
            hintLevel: r.result === 'hinted' ? 1 : 0,
            chosen: r.chosen,
            elapsedMs: r.elapsedMs === null ? null : Math.round(r.elapsedMs),
            ...(r.tries !== undefined ? { tries: r.tries } : {}),
          }),
        delays,
      ).then(
        () => void failed.current.delete(r.ordinal),
        () => void failed.current.set(r.ordinal, r),
      ),
    [sessionId, ioRef],
  );

  useEffect(() => {
    for (const r of state.results) {
      if (posted.current.has(r.ordinal)) continue;
      posted.current.add(r.ordinal);
      stepPosts.current.set(r.ordinal, trackIn(inflight.current, postStep(r)));
    }
  }, [state.results, postStep]);

  // Play-back is recorded once per question, after its answer has been stored.
  const playbackPosted = useRef<Set<number>>(
    new Set(session.results.filter((r) => r.playedBack).map((r) => r.ordinal)),
  );
  useEffect(() => {
    if (!state.playedBack || question === undefined) return;
    const ordinal = question.ordinal;
    if (playbackPosted.current.has(ordinal)) return;
    playbackPosted.current.add(ordinal);
    const after = stepPosts.current.get(ordinal) ?? Promise.resolve();
    void trackIn(
      inflight.current,
      after
        .then(() => withRetry(() => ioRef.current.recordPlayback({ sessionId, ordinal })))
        .then(
          () => undefined,
          () => undefined,
        ),
    );
  }, [state.playedBack, question, sessionId, ioRef]);

  // ---------------------------------------------------------------- MIDI play-back detection

  const spec = useMemo(() => (question ? playbackSpec(question) : null), [question]);
  const sequence = useRef<{ q: number; match: MatchState } | null>(null);

  // `notes` prompts: ordered note-ons in any octave (a wrong note resets silently).
  useMidiEvents((e) => {
    const s = stateRef.current;
    if (e.type !== 'on' || s.phase !== 'answered' || s.playedBack) return;
    const target = currentQuestion(s);
    const seqSpec = target ? playbackSpec(target) : null;
    if (seqSpec?.type !== 'sequence') return;
    const prev = sequence.current?.q === s.q ? sequence.current.match : initialMatchState(seqSpec);
    const match = reduceMatch(seqSpec, prev, { type: 'noteOn', midi: e.midi });
    sequence.current = { q: s.q, match };
    if (match.status === 'matched') dispatch({ type: 'PLAYED_BACK', q: s.q });
  });

  // `chord` prompts: the held pitch-class set equals the chord's.
  const held = useHeldNotes();
  useEffect(() => {
    if (spec?.type !== 'chord' || state.phase !== 'answered' || state.playedBack) return;
    const match = reduceMatch(spec, initialMatchState(spec), { type: 'held', held });
    if (match.status === 'matched') dispatch({ type: 'PLAYED_BACK', q: state.q });
  }, [held, spec, state.phase, state.playedBack, state.q]);

  // ---------------------------------------------------------------- find the key: root hunt

  // engine.md §1 `root` / §6.13: while home is not found, note-ons go to the root matcher and a
  // released wrong note becomes a try (the reducer ignores events outside the hunt).
  useMidiEvents((e) => {
    const s = stateRef.current;
    if (s.root.found || currentQuestion(s)?.match.type !== 'root') return;
    dispatch(
      e.type === 'on'
        ? { type: 'ROOT_NOTE', midi: e.midi }
        : { type: 'ROOT_RELEASE', midi: e.midi },
    );
  });

  const playHint = useCallback(() => {
    const s = stateRef.current;
    const target = currentQuestion(s);
    if (target?.hint === undefined || busy.current) return;
    if (s.phase !== 'idle' && s.phase !== 'listening') return;
    dispatch({ type: 'HINT' });
    busy.current = true;
    void audioRef.current
      .play(target.hint)
      .catch(() => undefined)
      .finally(() => {
        busy.current = false;
      });
  }, [stateRef, audioRef]);

  // ---------------------------------------------------------------- finish

  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const finishStarted = useRef(false);
  const runFinish = useCallback(async () => {
    setFinishing(true);
    setFinishError(null);
    try {
      await Promise.all([...inflight.current]);
      for (const r of [...failed.current.values()]) await postStep(r, [500]);
      if (failed.current.size > 0) throw new Error('recordStep failed');
      const dto = await ioRef.current.finish({
        sessionId,
        durationMs: durationMs(stateRef.current, Date.now()),
      });
      onFinishedRef.current(dto);
    } catch {
      setFinishError('Couldn’t save these answers. Try again.');
      finishStarted.current = false;
    } finally {
      setFinishing(false);
    }
  }, [postStep, sessionId, ioRef, stateRef, onFinishedRef]);

  useEffect(() => {
    if (state.phase !== 'done' || finishStarted.current) return;
    finishStarted.current = true;
    let fired = false;
    const t = setTimeout(() => {
      fired = true;
      void runFinish();
    }, 0);
    return () => {
      clearTimeout(t);
      if (!fired) finishStarted.current = false;
    };
  }, [state.phase, runFinish]);

  const retryFinish = useCallback(() => {
    if (stateRef.current.phase !== 'done' || finishStarted.current) return;
    finishStarted.current = true;
    void runFinish();
  }, [stateRef, runFinish]);

  // ---------------------------------------------------------------- e2e / dev hook

  useEffect(() => {
    const dev = window.__cadenceDev;
    if (!dev) return;
    dev.ear = {
      currentAnswer:
        question === undefined
          ? null
          : question.match.type === 'choice'
            ? question.match.answer
            : question.match.type === 'root'
              ? question.match.note
              : null,
      stepId: question?.id ?? null,
      notes: soundNotes(question?.play).map(noteToMidi),
      q: state.q,
      phase: state.phase,
      // Find the key: the tonic's pitch class (0–11) and the major/minor answer.
      ...(question?.match.type === 'root'
        ? {
            tonicPc: pcNumber(question.match.note),
            answer: question.match.then?.type === 'choice' ? question.match.then.answer : null,
            found: state.root.found,
          }
        : {}),
    };
  }, [question, state.q, state.phase, state.root.found]);
  useEffect(
    () => () => {
      if (window.__cadenceDev) delete window.__cadenceDev.ear;
    },
    [],
  );

  // ---------------------------------------------------------------- actions

  const pick = useCallback(
    (option: string) => {
      if (!answersEnabled(stateRef.current)) return;
      dispatch({ type: 'PICK', option, at: Date.now() });
    },
    [stateRef],
  );

  const next = useCallback(() => {
    if (stateRef.current.phase !== 'answered') return;
    generation.current += 1;
    audioRef.current.stop();
    dispatch({ type: 'NEXT' });
  }, [stateRef, audioRef]);

  return {
    state,
    question,
    enabled: answersEnabled(state),
    playing: audio.playing,
    play,
    playContext,
    pick,
    next,
    hint: useCallback(() => dispatch({ type: 'HINT' }), []),
    playHint,
    finishing,
    finishError,
    retryFinish,
  };
}

/** The real IPC side effects; XP/streak pills and plan refresh after each recorded answer. */
export function useLiveEarIo(): EarIo {
  const invalidateRef = useLatest(useInvalidateProgress());
  return useMemo<EarIo>(
    () => ({
      recordStep: async (input) => {
        const result = await api['sessions.recordStep'](input);
        void invalidateRef.current();
        return result;
      },
      recordPlayback: async (input) => {
        const result = await api['sessions.recordPlayback'](input);
        void invalidateRef.current();
        return result;
      },
      finish: (input) => api['sessions.finish'](input),
    }),
    [invalidateRef],
  );
}
