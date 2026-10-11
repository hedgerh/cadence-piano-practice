// Find the key fixtures over real content (no React): the dev screen and unit tests share them.
// EarKey.dc.html: Level 1, phrase 2 of 5, one right so far; home E found after trying G, then A.
import { earTraining, type Level } from '@cadence/content';
import { isPitchClass, pcNumber } from '@cadence/music';
import {
  earReducer,
  initialEarState,
  type EarDrillAction,
  type EarDrillState,
  type EarSession,
} from './earDrillReducer';

/** EarKey:41–47 — q1 answered right, q2 (E minor) on screen. */
export const KEY_ORDER = ['c-major-1', 'e-minor-1', 'g-major-2', 'a-minor-1', 'd-major-1'] as const;

function findKeyLevel(levelId: string): Level {
  const stage = earTraining().stages?.find((s) => s.id === 'find-the-key');
  const level = stage?.levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`no find-the-key level ${levelId}`);
  return level;
}

/** A SessionDto for a Find the key level; the first `answeredRight` questions are recorded clean. */
export function keySessionFixture(
  stepIds: readonly string[] = KEY_ORDER,
  answeredRight = 1,
  levelId = 'find-the-key-1',
): EarSession {
  const level = findKeyLevel(levelId);
  const pool = level.pool ?? [];
  const questions = stepIds.map((id, ordinal) => {
    const step = pool.find((s) => s.id === id);
    if (!step) throw new Error(`no step ${id} in ${levelId}`);
    return { ...step, ordinal };
  });
  return {
    sessionId: `dev-${levelId}`,
    focus: null,
    run: null,
    runProgress: null,
    trackId: 'ear-training',
    trackTitle: 'Ear training',
    levelId,
    levelTitle: level.title,
    levelNote: level.note ?? null,
    shortTitle: `Find the key · ${level.title}`,
    stageTitle: 'Find the key',
    kind: 'learn',
    isEar: true,
    planBlockId: null,
    startedAt: 0,
    finishedAt: null,
    resumed: false,
    visibility: 'all',
    pass: level.pass ?? { correct: 4, of: 5 },
    steps: [],
    questions,
    results: questions.slice(0, answeredRight).map((q) => ({
      ordinal: q.ordinal,
      stepId: q.id,
      result: 'clean' as const,
      hintLevel: 0,
      chosen:
        q.match.type === 'root' && q.match.then?.type === 'choice' ? q.match.then.answer : null,
      tries: 1,
      playedBack: false,
      elapsedMs: 6000,
    })),
  };
}

/** A note name in octave 3 ("G" → G3 = 55), the octave the design's tries sit in (EarKey:105). */
export function octave3(name: string): number | null {
  return isPitchClass(name) ? 48 + pcNumber(name) : null;
}

export interface KeyStateOptions {
  /** Wrong notes (names, played in octave 3) before home. EarKey:105 → ['G', 'A']. */
  tries?: readonly string[];
  /** Hit the tonic (in octave 4, EarKey:104) after the tries. Default true. */
  found?: boolean;
  /** Pick a mode: the answer when `chosen` is omitted. */
  answered?: boolean;
  chosen?: string;
  hinted?: boolean;
}

/** Drive the real reducer to a Find the key state on the session's current question. */
export function keyDrillState(session: EarSession, opts: KeyStateOptions = {}): EarDrillState {
  const s0 = initialEarState(session);
  const q = s0.questions[s0.q];
  if (q?.match.type !== 'root') return s0;
  const actions: EarDrillAction[] = [
    { type: 'PLAY_START', q: s0.q, at: 0 },
    { type: 'PLAY_END', q: s0.q, at: 4100 },
  ];
  if (opts.hinted === true) actions.push({ type: 'HINT' });
  for (const name of opts.tries ?? []) {
    const midi = octave3(name);
    if (midi === null) continue;
    actions.push({ type: 'ROOT_NOTE', midi }, { type: 'ROOT_RELEASE', midi });
  }
  if (opts.found ?? true) actions.push({ type: 'ROOT_NOTE', midi: 60 + pcNumber(q.match.note) });
  if (opts.answered === true) {
    const answer = q.match.then?.type === 'choice' ? q.match.then.answer : '';
    actions.push({ type: 'PICK', option: opts.chosen ?? answer, at: 9000 });
  }
  return actions.reduce(earReducer, s0);
}
