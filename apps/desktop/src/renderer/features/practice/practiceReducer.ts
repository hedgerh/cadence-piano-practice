// docs/engine.md §5 Practice (`practiceReducer`) and §6 defaults 1–7. Pure: no React, no IPC.
// Practice.dc.html:136 / 223–225 is the design's state pseudo-code this machine generalises.
// Chord/voicing steps match the held set; `sequence` steps (scales) match NOTE_ON events, one
// at a time (HANDOFF §5: "Sequence matches accept notes one at a time in order").
import {
  initialMatchState,
  reduceMatch,
  type MatchSpec,
  type MatchState,
  type Midi,
} from '@cadence/music';
import type { ChannelOutput } from '@shared/ipc/contracts';

export type PracticeSession = ChannelOutput<'sessions.get'>;
export type PracticeStep = PracticeSession['steps'][number];
export type StepResult = PracticeSession['results'][number]['result'];
export type Visibility = PracticeSession['visibility'];
export type PracticePhase = 'listening' | 'matched' | 'advancing' | 'finished';
export type HintLevel = 0 | 1 | 2;

/** One resolved step, in the shape `sessions.recordStep` wants (minus the session id). */
export interface Resolution {
  ordinal: number;
  stepId: string;
  result: StepResult;
  hintLevel: number;
  elapsedMs: number | null;
}

export interface PracticeTimer {
  /** engine.md §6.7: set by the first note-on or the first hint/skip/mark. */
  startedAt: number | null;
  /** Set on the last resolve. */
  stoppedAt: number | null;
  /** Time already spent before this mount (sum of resumed results' `elapsedMs`). */
  baseMs: number;
  /** When the current step became current (null until the timer starts). */
  stepStartedAt: number | null;
}

export interface PracticeState {
  steps: readonly PracticeStep[];
  phase: PracticePhase;
  /** Ordinal (index into `steps`) of the step on screen; the last step once finished. */
  current: number;
  /** Ordinals not yet visited, in level order. */
  order: readonly number[];
  /** engine.md §6.1: once-skipped ordinals, revisited after `order`. */
  queue: readonly number[];
  /** Every ordinal that has been skipped once (a second skip resolves `skipped`). */
  skippedOnce: readonly number[];
  hint: HintLevel;
  /** engine.md §6.6: false after a match until every key is released. */
  armed: boolean;
  held: ReadonlySet<Midi>;
  match: MatchState;
  /** Keys flashing teal while `phase === 'matched'` (the notes that matched, or the whole run). */
  flash: readonly Midi[];
  /** Resolutions in the order they happened (resumed ones first). */
  results: readonly Resolution[];
  vis: Visibility;
  timer: PracticeTimer;
  /**
   * How many times the key was restarted (`RESTART_LEVEL`). Replayed steps post again under the
   * same ordinals; the server keeps the latest result and never awards a step's XP twice.
   */
  round: number;
}

export type PracticeAction =
  | { type: 'HELD_CHANGED'; held: ReadonlySet<Midi>; at: number }
  /** Every MIDI note-on: drives `sequence` steps (chords ignore it and use the held set). */
  | { type: 'NOTE_ON'; midi: Midi; at: number }
  | { type: 'HINT'; at: number }
  | { type: 'SKIP'; at: number }
  | { type: 'MARK_PLAYED'; at: number }
  /**
   * decisions.md 2026-10-14 "Progression help": a progression step back to its first chord
   * (keys still down must be let go first). Other steps ignore it.
   */
  | { type: 'RESTART_STEP' }
  /**
   * decisions.md 2026-10-14 "Restart key": back to step 1 of the key, every step pending again
   * (results already saved stay until replayed). Keys still down must be let go first.
   */
  | { type: 'RESTART_LEVEL'; at: number }
  /** 600 ms after a match (effect): matched → advancing. */
  | { type: 'FLASH_DONE' }
  /** advancing → next step in order, then the queue, else finished. */
  | { type: 'ADVANCE'; at: number }
  | { type: 'SET_VIS'; vis: Visibility };

/** Practice:192 — indexed by the current hint level. */
export const HINT_LABELS = [
  'Give me a hint',
  'Show it on the keys',
  'That is all the hints',
] as const;

/** engine.md §6.6 — "teal flash ~600 ms, auto-advance". */
export const FLASH_MS = 600;

const EMPTY_HELD: ReadonlySet<Midi> = new Set();

export function initialPracticeState(
  session: Pick<PracticeSession, 'steps' | 'results' | 'visibility'>,
): PracticeState {
  const total = session.steps.length;
  const seen = new Set<number>();
  const results: Resolution[] = [];
  for (const r of session.results) {
    if (r.ordinal < 0 || r.ordinal >= total || seen.has(r.ordinal)) continue;
    seen.add(r.ordinal);
    results.push({
      ordinal: r.ordinal,
      stepId: r.stepId,
      result: r.result,
      hintLevel: r.hintLevel,
      elapsedMs: r.elapsedMs,
    });
  }
  const pending = session.steps.map((_, i) => i).filter((i) => !seen.has(i));
  const [first, ...rest] = pending;
  const baseMs = results.reduce((sum, r) => sum + (r.elapsedMs ?? 0), 0);
  const step = first !== undefined ? session.steps[first] : undefined;
  return {
    steps: session.steps,
    phase: first === undefined ? 'finished' : 'listening',
    current: first ?? Math.max(0, total - 1),
    order: rest,
    queue: [],
    skippedOnce: [],
    hint: 0,
    armed: true,
    held: EMPTY_HELD,
    match: step ? initialMatchState(step.match) : initialMatchState({ type: 'chord', notes: [] }),
    flash: [],
    results,
    vis: session.visibility,
    timer: { startedAt: null, stoppedAt: null, baseMs, stepStartedAt: null },
    round: 0,
  };
}

export function currentStep(state: PracticeState): PracticeStep | undefined {
  return state.steps[state.current];
}

function specOf(state: PracticeState): MatchSpec | undefined {
  return currentStep(state)?.match;
}

function startTimer(state: PracticeState, at: number): PracticeState {
  if (state.timer.startedAt !== null) return state;
  return {
    ...state,
    timer: { ...state.timer, startedAt: at, stepStartedAt: state.timer.stepStartedAt ?? at },
  };
}

function resolve(state: PracticeState, result: StepResult, at: number): PracticeState {
  const step = currentStep(state);
  if (!step) return state;
  const since = state.timer.stepStartedAt ?? state.timer.startedAt ?? at;
  const resolution: Resolution = {
    ordinal: state.current,
    stepId: step.id,
    result,
    hintLevel: state.hint,
    elapsedMs: Math.max(0, Math.round(at - since)),
  };
  const last = state.order.length === 0 && state.queue.length === 0;
  return {
    ...state,
    results: [...state.results, resolution],
    timer: last ? { ...state.timer, stoppedAt: at } : state.timer,
  };
}

function moveNext(state: PracticeState, at: number): PracticeState {
  const [fromOrder, ...order] = state.order;
  let next: number | undefined;
  let queue = state.queue;
  if (fromOrder !== undefined) next = fromOrder;
  else {
    [next, ...queue] = state.queue;
  }
  const base = { ...state, hint: 0 as HintLevel, flash: [] };
  if (next === undefined) {
    return {
      ...base,
      phase: 'finished',
      order: [],
      queue: [],
      timer: { ...state.timer, stoppedAt: state.timer.stoppedAt ?? at },
    };
  }
  const step = state.steps[next];
  return {
    ...base,
    phase: 'listening',
    current: next,
    order: fromOrder !== undefined ? order : state.order,
    queue,
    armed: state.held.size === 0,
    match: step ? initialMatchState(step.match) : state.match,
    timer: { ...state.timer, stepStartedAt: state.timer.startedAt !== null ? at : null },
  };
}

export function practiceReducer(state: PracticeState, action: PracticeAction): PracticeState {
  switch (action.type) {
    case 'HELD_CHANGED': {
      const held = action.held;
      let s: PracticeState = { ...state, held };
      if (held.size > 0 && state.phase !== 'finished') s = startTimer(s, action.at);
      if (held.size === 0) {
        const spec = specOf(s);
        return {
          ...s,
          armed: true,
          match:
            s.phase === 'listening' && spec
              ? reduceMatch(spec, s.match, { type: 'held', held })
              : s.match,
        };
      }
      if (s.phase !== 'listening' || !s.armed) return s;
      const spec = specOf(s);
      if (!spec) return s;
      const match = reduceMatch(spec, s.match, { type: 'held', held });
      if (match.status !== 'matched') return { ...s, match };
      const resolved = resolve(s, s.hint > 0 ? 'hinted' : 'clean', action.at);
      return { ...resolved, match, phase: 'matched', armed: false, flash: [...held] };
    }
    case 'NOTE_ON': {
      // A held key never re-fires a note-on, so sequences need no re-arming between steps.
      const spec = specOf(state);
      if (state.phase !== 'listening' || spec?.type !== 'sequence') return state;
      const s = startTimer(state, action.at);
      const match = reduceMatch(spec, s.match, { type: 'noteOn', midi: action.midi });
      if (match.status !== 'matched') return { ...s, match };
      const resolved = resolve(s, s.hint > 0 ? 'hinted' : 'clean', action.at);
      return { ...resolved, match, phase: 'matched', flash: match.played };
    }
    case 'HINT': {
      if (state.phase !== 'listening' || state.hint >= 2) return state;
      const s = startTimer(state, action.at);
      return { ...s, hint: (s.hint + 1) as HintLevel };
    }
    case 'SKIP': {
      if (state.phase !== 'listening') return state;
      const s = startTimer(state, action.at);
      if (s.skippedOnce.includes(s.current)) {
        return moveNext(resolve(s, 'skipped', action.at), action.at);
      }
      return moveNext(
        { ...s, queue: [...s.queue, s.current], skippedOnce: [...s.skippedOnce, s.current] },
        action.at,
      );
    }
    case 'MARK_PLAYED': {
      if (state.phase !== 'listening') return state;
      const s = startTimer(state, action.at);
      return moveNext(resolve(s, 'marked', action.at), action.at);
    }
    case 'RESTART_STEP': {
      const spec = specOf(state);
      if (state.phase !== 'listening' || spec?.type !== 'progression') return state;
      return { ...state, match: initialMatchState(spec), armed: state.held.size === 0 };
    }
    case 'RESTART_LEVEL': {
      if (!canRestartLevel(state)) return state;
      const first = state.steps[0];
      if (!first) return state;
      return {
        ...state,
        phase: 'listening',
        current: 0,
        order: state.steps.map((_, i) => i).slice(1),
        queue: [],
        skippedOnce: [],
        hint: 0,
        armed: state.held.size === 0,
        match: initialMatchState(first.match),
        flash: [],
        results: [],
        timer: {
          ...state.timer,
          stepStartedAt: state.timer.startedAt !== null ? action.at : null,
        },
        round: state.round + 1,
      };
    }
    case 'FLASH_DONE':
      return state.phase === 'matched' ? { ...state, phase: 'advancing' } : state;
    case 'ADVANCE':
      return state.phase === 'advancing' ? moveNext(state, action.at) : state;
    case 'SET_VIS':
      return state.vis === action.vis ? state : { ...state, vis: action.vis };
  }
}

// ---------------------------------------------------------------- selectors

/** "Restart key" shows once the key is under way and not yet finished. */
export function canRestartLevel(state: PracticeState): boolean {
  return state.phase === 'listening' && (state.current !== 0 || state.results.length > 0);
}

export function resultFor(state: PracticeState, ordinal: number): Resolution | undefined {
  return state.results.find((r) => r.ordinal === ordinal);
}

/** Practice:46 "{{doneCount}} of {{total}} chords": played or marked (skips do not count). */
export function doneCount(state: PracticeState): number {
  return state.results.filter((r) => r.result !== 'skipped' && r.result !== 'wrong').length;
}

export function skippedOrdinals(state: PracticeState): number[] {
  return state.results.filter((r) => r.result === 'skipped').map((r) => r.ordinal);
}

/** Total practice time for `sessions.finish`. */
export function durationMs(state: PracticeState, now: number): number {
  const { startedAt, stoppedAt, baseMs } = state.timer;
  if (startedAt === null) return Math.round(baseMs);
  return Math.max(0, Math.round(baseMs + (stoppedAt ?? now) - startedAt));
}
