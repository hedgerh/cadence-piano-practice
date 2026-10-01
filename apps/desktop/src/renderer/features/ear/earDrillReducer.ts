// docs/engine.md §5 Ear (earDrillReducer) and §6 defaults 10–12 (HANDOFF §5 ear loop).
// Pure: (state, action) → state. Effects (audio, MIDI, IPC) live in useEarDrill.ts.
//
//   idle       a question is on screen; nothing has played yet (answers disabled)
//   listening  the prompt has started; answers enable once the first play finished (`played`)
//   answered   PICK counted the answer (the segment turns teal/lavender immediately, §6.12)
//   done       NEXT after the last question → sessions.finish → /ear/results/:id
import { initialMatchState, reduceMatch, type MatchSpec, type MatchState } from '@cadence/music';
import type { ChannelOutput } from '@shared/ipc/contracts';

export type EarSession = ChannelOutput<'sessions.start'>;
export type EarQuestion = EarSession['questions'][number];
export type EarPhase = 'idle' | 'listening' | 'answered' | 'done';
export type EarResultKind = 'clean' | 'hinted' | 'wrong';

export interface EarResult {
  ordinal: number;
  stepId: string;
  result: EarResultKind;
  chosen: string | null;
  correct: boolean;
  playedBack: boolean;
  elapsedMs: number | null;
  /** Find the key: the try the home note was found on (1 = first try) → `recordStep.tries`. */
  tries?: number | null;
}

/** Find the key (Task 15): the root hunt before the major/minor choice. */
export interface RootHunt {
  found: boolean;
  /** MIDI notes tried before the tonic was found (appended on release, §6.13). */
  tries: readonly number[];
  /** Wrong notes pressed while hunting and not yet released (they join `tries` on release). */
  pending?: readonly number[];
}

export interface EarDrillState {
  phase: EarPhase;
  /** Index into `questions` (= the question's position; ordinals come from the question). */
  q: number;
  questions: readonly EarQuestion[];
  pass: { correct: number; of: number };
  /** The current question's first play has finished: answers are enabled (§6.10). */
  played: boolean;
  chosen: string | null;
  correct: boolean | null;
  /** The current question's play-back was verified (+5 once, §6.11). */
  playedBack: boolean;
  /** A hint was used on the current question (find the key, Task 15) → result `hinted`. */
  hinted: boolean;
  results: readonly EarResult[];
  root: RootHunt;
  /** When answers were enabled for the current question (elapsedMs on PICK). */
  shownAt: number | null;
  /** First play of the session (duration). */
  startedAt: number | null;
}

export type EarDrillAction =
  /** The prompt started sounding for question `q` (auto-play or the play button). */
  | { type: 'PLAY_START'; q: number; at: number }
  /** The first play of question `q` finished: answers enable. */
  | { type: 'PLAY_END'; q: number; at: number }
  | { type: 'PICK'; option: string; at: number }
  /** MIDI matched the prompt for question `q`. */
  | { type: 'PLAYED_BACK'; q: number }
  | { type: 'HINT' }
  | { type: 'NEXT' }
  /** Find the key: a note-on while hunting for the tonic (`reduceMatch(root)`). */
  | { type: 'ROOT_NOTE'; midi: number }
  /** Find the key: a note-off; a released wrong note becomes a try. */
  | { type: 'ROOT_RELEASE'; midi: number };

/** engine.md §2.2: 8 of 10 unless the level says otherwise. */
export const DEFAULT_PASS = { correct: 8, of: 10 } as const;

const EMPTY_ROOT: RootHunt = { found: false, tries: [] };

const perQuestion = {
  played: false,
  chosen: null,
  correct: null,
  playedBack: false,
  hinted: false,
  root: EMPTY_ROOT,
  shownAt: null,
} as const;

function asEarResult(r: EarSession['results'][number]): EarResult {
  const result: EarResultKind = r.result === 'clean' || r.result === 'hinted' ? r.result : 'wrong';
  return {
    ordinal: r.ordinal,
    stepId: r.stepId,
    result,
    chosen: r.chosen,
    correct: result !== 'wrong',
    playedBack: r.playedBack,
    elapsedMs: r.elapsedMs,
    ...(r.tries !== null ? { tries: r.tries } : {}),
  };
}

/** Start (or resume, from `sessions.get` results) at the first unanswered question. */
export function initialEarState(session: EarSession): EarDrillState {
  const questions = session.questions;
  const byOrdinal = new Map(session.results.map((r) => [r.ordinal, r]));
  const results: EarResult[] = [];
  for (const question of questions) {
    const r = byOrdinal.get(question.ordinal);
    if (r === undefined) break;
    results.push(asEarResult(r));
  }
  const q = results.length;
  return {
    phase: questions.length > 0 && q >= questions.length ? 'done' : 'idle',
    q,
    questions,
    pass: session.pass ?? DEFAULT_PASS,
    ...perQuestion,
    results,
    startedAt: null,
  };
}

export function currentQuestion(state: EarDrillState): EarQuestion | undefined {
  return state.questions[state.q];
}

/** §6.10: answers are disabled until the first play of the question has finished. */
export function answersEnabled(state: EarDrillState): boolean {
  return state.phase === 'listening' && state.played;
}

export function earReducer(state: EarDrillState, action: EarDrillAction): EarDrillState {
  switch (action.type) {
    case 'PLAY_START': {
      if (action.q !== state.q || state.phase === 'done') return state;
      const startedAt = state.startedAt ?? action.at;
      if (state.phase !== 'idle')
        return startedAt === state.startedAt ? state : { ...state, startedAt };
      return { ...state, phase: 'listening', startedAt };
    }
    case 'PLAY_END': {
      if (action.q !== state.q || state.phase !== 'listening' || state.played) return state;
      return { ...state, played: true, shownAt: action.at };
    }
    case 'PICK': {
      const question = currentQuestion(state);
      if (!answersEnabled(state) || question === undefined) return state;
      if (question.match.type === 'root') return pickMode(state, question, action);
      if (question.match.type !== 'choice') return state;
      if (!question.match.options.includes(action.option)) return state;
      const correct = action.option === question.match.answer;
      const result: EarResultKind = correct ? (state.hinted ? 'hinted' : 'clean') : 'wrong';
      return {
        ...state,
        phase: 'answered',
        chosen: action.option,
        correct,
        results: [
          ...state.results,
          {
            ordinal: question.ordinal,
            stepId: question.id,
            result,
            chosen: action.option,
            correct,
            playedBack: false,
            elapsedMs: state.shownAt === null ? null : Math.max(0, action.at - state.shownAt),
          },
        ],
      };
    }
    case 'PLAYED_BACK': {
      if (action.q !== state.q || state.phase !== 'answered' || state.playedBack) return state;
      const results = state.results.map((r, i) =>
        i === state.results.length - 1 ? { ...r, playedBack: true } : r,
      );
      return { ...state, playedBack: true, results };
    }
    case 'HINT':
      return state.phase === 'idle' || state.phase === 'listening'
        ? { ...state, hinted: true }
        : state;
    case 'NEXT': {
      if (state.phase !== 'answered') return state;
      const q = state.q + 1;
      if (q >= state.questions.length) return { ...state, phase: 'done' };
      return { ...state, ...perQuestion, phase: 'idle', q };
    }
    case 'ROOT_NOTE':
      return rootNote(state, action.midi);
    case 'ROOT_RELEASE':
      return rootRelease(state, action.midi);
  }
}

// ---------------------------------------------------------------- find the key (Task 15)

type RootSpec = Extract<MatchSpec, { type: 'root' }>;

/** The current question's `root` match while the hunt is on (phrase started, home not found). */
function huntSpec(state: EarDrillState): RootSpec | null {
  const match = currentQuestion(state)?.match;
  if (match?.type !== 'root' || state.root.found || state.phase !== 'listening') return null;
  return match;
}

/** engine.md §6.13: clean only if home was found within 2 tries and no hint was used. */
export const CLEAN_WITHIN_TRIES = 2;

/** The try the home note was found (or will be found) on: wrong notes so far + 1. */
export function rootTryNumber(root: RootHunt): number {
  return root.tries.length + 1;
}

/**
 * engine.md §1 `root` match: a note-on whose pitch class is the tonic (any octave) finds home;
 * a wrong note shows as held and becomes a try when released (unlimited tries, §6.13).
 */
function rootNote(state: EarDrillState, midi: number): EarDrillState {
  const spec = huntSpec(state);
  if (spec === null) return state;
  const before: MatchState = { ...initialMatchState(spec), tries: state.root.tries };
  const after = reduceMatch(spec, before, { type: 'noteOn', midi });
  const pending = state.root.pending ?? [];
  // Wrong notes still held when home is hit were tries too.
  if (after.found) return { ...state, root: { found: true, tries: [...after.tries, ...pending] } };
  if (pending.includes(midi)) return state;
  return { ...state, root: { ...state.root, pending: [...pending, midi] } };
}

function rootRelease(state: EarDrillState, midi: number): EarDrillState {
  if (huntSpec(state) === null) return state;
  const pending = state.root.pending ?? [];
  if (!pending.includes(midi)) return state;
  return {
    ...state,
    root: {
      found: false,
      tries: [...state.root.tries, midi],
      pending: pending.filter((m) => m !== midi),
    },
  };
}

/**
 * Step 2 (`root.then`, major/minor), only once home is found. `clean` iff home was found within
 * {@link CLEAN_WITHIN_TRIES} tries with no hint; `hinted` if right otherwise; `wrong` if the mode
 * is wrong (engine.md §6.13). The try number goes to `recordStep.tries`.
 */
function pickMode(
  state: EarDrillState,
  question: EarQuestion,
  action: { option: string; at: number },
): EarDrillState {
  const match = question.match;
  if (match.type !== 'root' || !state.root.found) return state;
  const then = match.then;
  if (then?.type !== 'choice' || !then.options.includes(action.option)) return state;
  const picked = reduceMatch(then, initialMatchState(then), {
    type: 'choose',
    option: action.option,
  });
  const correct = picked.status === 'matched';
  const tries = rootTryNumber(state.root);
  const clean = !state.hinted && tries <= CLEAN_WITHIN_TRIES;
  const result: EarResultKind = correct ? (clean ? 'clean' : 'hinted') : 'wrong';
  return {
    ...state,
    phase: 'answered',
    chosen: action.option,
    correct,
    results: [
      ...state.results,
      {
        ordinal: question.ordinal,
        stepId: question.id,
        result,
        chosen: action.option,
        correct,
        playedBack: false,
        elapsedMs: state.shownAt === null ? null : Math.max(0, action.at - state.shownAt),
        tries,
      },
    ],
  };
}

// ---------------------------------------------------------------- selectors

export function correctCount(state: EarDrillState): number {
  return state.results.filter((r) => r.correct).length;
}

/** engine.md §4: ear `passed = correct ≥ pass.correct` (the engine decides; this mirrors it). */
export function passed(state: EarDrillState): boolean {
  return state.phase === 'done' && correctCount(state) >= state.pass.correct;
}

export type EarSegment = 'done' | 'current' | 'wrong' | 'empty';

/** EarInterval:158–164 — answered teal / missed lavender / current tangerine / rest sand. */
export function earSegments(state: EarDrillState): EarSegment[] {
  return state.questions.map((_, i): EarSegment => {
    const r = state.results[i];
    if (r !== undefined) return r.correct ? 'done' : 'wrong';
    return i === state.q && state.phase !== 'done' ? 'current' : 'empty';
  });
}

/** EarInterval:45 — "2 right · question 4 of 10". */
export function progressLabel(state: EarDrillState): string {
  const total = state.questions.length;
  const qNo = Math.min(total, state.q + 1);
  return `${correctCount(state)} right · question ${qNo} of ${total}`;
}

export function durationMs(state: EarDrillState, now: number): number {
  return state.startedAt === null ? 0 : Math.max(0, Math.round(now - state.startedAt));
}
