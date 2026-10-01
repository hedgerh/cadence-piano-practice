// docs/engine.md §5 Ear (earDrillReducer) and §6 defaults 10–12 (HANDOFF §5 ear loop).
// Pure: (state, action) → state. Effects (audio, MIDI, IPC) live in useEarDrill.ts.
//
//   idle       a question is on screen; nothing has played yet (answers disabled)
//   listening  the prompt has started; answers enable once the first play finished (`played`)
//   answered   PICK counted the answer (the segment turns teal/lavender immediately, §6.12)
//   done       NEXT after the last question → sessions.finish → /ear/results/:id
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
}

/** Find the key (Task 15): the root hunt before the major/minor choice. */
export interface RootHunt {
  found: boolean;
  /** MIDI notes tried before the tonic was found. */
  tries: readonly number[];
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
  /** Task 15 placeholder: a note played while hunting for the tonic. Not implemented yet. */
  | { type: 'ROOT_NOTE'; midi: number };

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
      // Task 15 (Find the key) implements the root hunt into `state.root`.
      return state;
  }
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
