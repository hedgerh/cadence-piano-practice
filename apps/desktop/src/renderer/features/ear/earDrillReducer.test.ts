// docs/engine.md §5 Ear reducer; §6 defaults 10–12 (HANDOFF §5 ear loop: name it, play it back).
import { describe, expect, it } from 'vitest';
import { earSessionFixture, INTERVAL_ORDER } from './fixtures';
import {
  answersEnabled,
  correctCount,
  earReducer,
  earSegments,
  initialEarState,
  passed,
  progressLabel,
  type EarDrillAction,
  type EarDrillState,
} from './earDrillReducer';

const ORDER = INTERVAL_ORDER;
const session = (answered: Parameters<typeof earSessionFixture>[2] = []) =>
  earSessionFixture(
    'intervals-3',
    ORDER.map((iv) => `up-C4-${iv}`),
    answered,
  );

const run = (s: EarDrillState, ...actions: EarDrillAction[]) => actions.reduce(earReducer, s);
const played = (s: EarDrillState, at = 1000) =>
  run(s, { type: 'PLAY_START', q: s.q, at }, { type: 'PLAY_END', q: s.q, at: at + 1750 });

/** Play, pick, next for the current question. */
function answer(s: EarDrillState, right: boolean): EarDrillState {
  const q = s.questions[s.q];
  if (q?.match.type !== 'choice') throw new Error('not a choice');
  const wrong = q.match.answer === 'P1' ? 'P8' : 'P1';
  return run(
    played(s),
    { type: 'PICK', option: right ? q.match.answer : wrong, at: 5000 },
    { type: 'NEXT' },
  );
}

describe('earReducer (engine.md §5)', () => {
  it('starts idle on question 1 with the root slot empty', () => {
    const s = initialEarState(session());
    expect(s.phase).toBe('idle');
    expect(s.q).toBe(0);
    expect(s.pass).toEqual({ correct: 8, of: 10 });
    expect(s.root).toEqual({ found: false, tries: [] });
    expect(progressLabel(s)).toBe('0 right · question 1 of 10');
  });

  it('§6.10: answers are disabled until the first play has finished', () => {
    const s0 = initialEarState(session());
    expect(answersEnabled(s0)).toBe(false);
    expect(earReducer(s0, { type: 'PICK', option: 'P5', at: 0 })).toBe(s0);

    const s1 = earReducer(s0, { type: 'PLAY_START', q: 0, at: 100 });
    expect(s1.phase).toBe('listening');
    expect(answersEnabled(s1)).toBe(false);
    expect(earReducer(s1, { type: 'PICK', option: 'P5', at: 0 })).toBe(s1);

    // A stale PLAY_END (another question) is ignored.
    expect(earReducer(s1, { type: 'PLAY_END', q: 3, at: 200 })).toBe(s1);
    const s2 = earReducer(s1, { type: 'PLAY_END', q: 0, at: 1850 });
    expect(s2.played).toBe(true);
    expect(answersEnabled(s2)).toBe(true);
    // Replays are free and do not reset anything.
    expect(earReducer(s2, { type: 'PLAY_START', q: 0, at: 3000 }).played).toBe(true);
  });

  it('PICK sets answered + correct and counts immediately (§6.12)', () => {
    const s = run(played(initialEarState(session())), { type: 'PICK', option: 'P5', at: 4850 });
    expect(s.phase).toBe('answered');
    expect(s.chosen).toBe('P5');
    expect(s.correct).toBe(true);
    expect(s.results).toEqual([
      {
        ordinal: 0,
        stepId: 'up-C4-P5',
        result: 'clean',
        chosen: 'P5',
        correct: true,
        playedBack: false,
        elapsedMs: 2100,
      },
    ]);
    expect(earSegments(s)[0]).toBe('done');
    // Only one answer per question.
    expect(earReducer(s, { type: 'PICK', option: 'P1', at: 5000 })).toBe(s);
  });

  it('a wrong pick records `wrong` and the segment turns lavender at once', () => {
    const s = run(played(initialEarState(session())), { type: 'PICK', option: 'M3', at: 5000 });
    expect(s.correct).toBe(false);
    expect(s.results[0]?.result).toBe('wrong');
    expect(earSegments(s).slice(0, 2)).toEqual(['wrong', 'empty']);
  });

  it('ignores options the step does not offer', () => {
    const s = played(initialEarState(session()));
    expect(earReducer(s, { type: 'PICK', option: 'X9', at: 0 })).toBe(s);
  });

  it('a hint makes a correct answer `hinted` (Task 15 uses it)', () => {
    const s = run(
      initialEarState(session()),
      { type: 'HINT' },
      { type: 'PLAY_START', q: 0, at: 0 },
      { type: 'PLAY_END', q: 0, at: 1 },
      { type: 'PICK', option: 'P5', at: 2 },
    );
    expect(s.results[0]?.result).toBe('hinted');
    expect(correctCount(s)).toBe(1);
  });

  it('§6.11: play-back awards once per question, only after answering', () => {
    const before = played(initialEarState(session()));
    expect(earReducer(before, { type: 'PLAYED_BACK', q: 0 })).toBe(before);
    const s = run(before, { type: 'PICK', option: 'P5', at: 5000 }, { type: 'PLAYED_BACK', q: 0 });
    expect(s.playedBack).toBe(true);
    expect(s.results[0]?.playedBack).toBe(true);
    expect(earReducer(s, { type: 'PLAYED_BACK', q: 0 })).toBe(s);
    expect(earReducer(s, { type: 'PLAYED_BACK', q: 1 })).toBe(s);
  });

  it('NEXT advances and resets the per-question fields', () => {
    const s = run(
      played(initialEarState(session())),
      { type: 'PICK', option: 'P5', at: 5000 },
      { type: 'PLAYED_BACK', q: 0 },
      { type: 'NEXT' },
    );
    expect(s.phase).toBe('idle');
    expect(s.q).toBe(1);
    expect(s).toMatchObject({ played: false, chosen: null, correct: null, playedBack: false });
    expect(earSegments(s).slice(0, 3)).toEqual(['done', 'current', 'empty']);
    expect(progressLabel(s)).toBe('1 right · question 2 of 10');
    // NEXT only from answered.
    expect(earReducer(s, { type: 'NEXT' })).toBe(s);
  });

  it('after 10 → done with passed = correct ≥ 8', () => {
    let s = initialEarState(session());
    for (let i = 0; i < 10; i++) s = answer(s, i !== 2 && i !== 5);
    expect(s.phase).toBe('done');
    expect(correctCount(s)).toBe(8);
    expect(passed(s)).toBe(true);
    expect(earSegments(s).filter((x) => x === 'current')).toEqual([]);

    let f = initialEarState(session());
    for (let i = 0; i < 10; i++) f = answer(f, i > 2);
    expect(f.phase).toBe('done');
    expect(correctCount(f)).toBe(7);
    expect(passed(f)).toBe(false);
  });

  it('resumes from recorded results at the first unanswered question', () => {
    const s = initialEarState(
      session([
        { stepId: 'up-C4-P5', chosen: 'P5' },
        { stepId: 'up-C4-M3', chosen: 'M3' },
        { stepId: 'up-C4-m3', chosen: 'M2' },
      ]),
    );
    expect(s.q).toBe(3);
    expect(s.phase).toBe('idle');
    expect(earSegments(s).slice(0, 5)).toEqual(['done', 'done', 'wrong', 'current', 'empty']);
    expect(progressLabel(s)).toBe('2 right · question 4 of 10');
  });

  it('ROOT_NOTE is a Task 15 placeholder (no-op for now)', () => {
    const s = initialEarState(session());
    expect(earReducer(s, { type: 'ROOT_NOTE', midi: 60 })).toBe(s);
  });
});
