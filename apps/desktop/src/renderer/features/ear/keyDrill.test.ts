// Find the key (Task 15): earReducer root flow — engine.md §1 `root` match with `then`, §5 Ear
// reducer, §6.13 (unlimited tries, clean only within 2 tries with no hint, home lights every
// octave, tries in the octave played), §6.14 (5-question levels pass at 4/5). HANDOFF §5 ear loop.
import { pcNumber } from '@cadence/music';
import { describe, expect, it } from 'vitest';
import { earKeyFixture } from '../../dev/fixtures/earKey';
import {
  answersEnabled,
  earReducer,
  earSegments,
  initialEarState,
  passed,
  type EarDrillAction,
  type EarDrillState,
} from './earDrillReducer';
import { keyDrillState, keySessionFixture, KEY_ORDER } from './keyFixtures';
import {
  feedbackKeys,
  keyboardStates,
  keyFeedback,
  keyProgressLabel,
  modeLabel,
  modeOptions,
  questionKey,
  stepOneCopy,
  stepTwoCopy,
  triesList,
} from './keyModel';

const G3 = 55;
const A3 = 57;
const E3 = 52;
const E4 = 64;
const E2 = 40;

const run = (s: EarDrillState, ...actions: EarDrillAction[]) => actions.reduce(earReducer, s);
const tap = (midi: number): EarDrillAction[] => [
  { type: 'ROOT_NOTE', midi },
  { type: 'ROOT_RELEASE', midi },
];

/** E minor on screen (q index 1), phrase started and finished. */
function hunting(): EarDrillState {
  return keyDrillState(keySessionFixture(), { found: false });
}

describe('earReducer — find the key root hunt (engine.md §1, §6.13)', () => {
  it('starts on phrase 2 of 5 with 1 right; 5-question levels pass at 4/5 (§6.14)', () => {
    const s = initialEarState(keySessionFixture());
    expect(s.q).toBe(1);
    expect(s.pass).toEqual({ correct: 4, of: 5 });
    expect(s.root).toEqual({ found: false, tries: [] });
    expect(keyProgressLabel(s)).toBe(earKeyFixture.progress);
    expect(earSegments(s)).toEqual(earKeyFixture.segments);
  });

  it('ignores notes before the phrase has started', () => {
    const s = initialEarState(keySessionFixture());
    expect(run(s, ...tap(G3), { type: 'ROOT_NOTE', midi: E4 })).toBe(s);
  });

  it('a wrong note becomes a try on release, in the octave played; the tonic finds home', () => {
    let s = hunting();
    s = run(s, { type: 'ROOT_NOTE', midi: G3 });
    expect(s.root.tries).toEqual([]); // still held: not a try yet
    expect(s.root.pending).toEqual([G3]);
    s = run(s, { type: 'ROOT_RELEASE', midi: G3 }, ...tap(A3));
    expect(s.root).toMatchObject({ found: false, tries: [G3, A3] });
    s = run(s, { type: 'ROOT_NOTE', midi: E4 });
    expect(s.root.found).toBe(true);
    expect(s.root.tries).toEqual([G3, A3]);
    // Once found, further notes change nothing.
    expect(run(s, ...tap(G3))).toBe(s);
  });

  it('the tonic counts in any octave', () => {
    expect(run(hunting(), { type: 'ROOT_NOTE', midi: E2 }).root.found).toBe(true);
    expect(run(hunting(), { type: 'ROOT_NOTE', midi: E3 }).root.found).toBe(true);
  });

  it('a wrong note still held when home is hit counts as a try', () => {
    const s = run(hunting(), { type: 'ROOT_NOTE', midi: G3 }, { type: 'ROOT_NOTE', midi: E4 });
    expect(s.root).toMatchObject({ found: true, tries: [G3] });
  });

  it('tries are unlimited', () => {
    let s = hunting();
    for (const m of [48, 50, 53, 55, 57, 59, 60, 62]) s = run(s, ...tap(m));
    expect(s.root.tries).toHaveLength(8);
    s = run(s, { type: 'ROOT_NOTE', midi: E4 });
    expect(s.root.found).toBe(true);
  });

  it('PICK is refused until home is found, and needs the phrase played (§6.10)', () => {
    const s = hunting();
    expect(answersEnabled(s)).toBe(true);
    expect(earReducer(s, { type: 'PICK', option: 'minor', at: 5000 })).toBe(s);
    const started = run(initialEarState(keySessionFixture()), {
      type: 'PLAY_START',
      q: 1,
      at: 0,
    });
    const found = run(started, { type: 'ROOT_NOTE', midi: E4 });
    expect(found.root.found).toBe(true);
    expect(earReducer(found, { type: 'PICK', option: 'minor', at: 1 })).toBe(found);
    // Only the `then` options are accepted.
    const ready = run(hunting(), { type: 'ROOT_NOTE', midi: E4 });
    expect(earReducer(ready, { type: 'PICK', option: 'diminished', at: 1 })).toBe(ready);
  });

  it('clean when found on the first or second try with no hint; tries recorded', () => {
    const first = run(
      hunting(),
      { type: 'ROOT_NOTE', midi: E4 },
      {
        type: 'PICK',
        option: 'minor',
        at: 9100,
      },
    );
    expect(first.phase).toBe('answered');
    expect(first.results[1]).toMatchObject({
      stepId: 'e-minor-1',
      result: 'clean',
      chosen: 'minor',
      correct: true,
      tries: 1,
      elapsedMs: 5000,
    });
    const second = run(
      hunting(),
      ...tap(G3),
      { type: 'ROOT_NOTE', midi: E4 },
      {
        type: 'PICK',
        option: 'minor',
        at: 9100,
      },
    );
    expect(second.results[1]).toMatchObject({ result: 'clean', tries: 2 });
  });

  it('hinted when right but found on the third try or later', () => {
    const s = keyDrillState(keySessionFixture(), { tries: ['G', 'A'], answered: true });
    expect(s.results[1]).toMatchObject({ result: 'hinted', correct: true, tries: 3 });
    expect(earSegments(s)[1]).toBe('done');
  });

  it('hinted when right after the hint, even on the first try', () => {
    const s = keyDrillState(keySessionFixture(), { tries: [], hinted: true, answered: true });
    expect(s.results[1]).toMatchObject({ result: 'hinted', tries: 1 });
  });

  it('wrong when the mode is wrong, however quickly home was found', () => {
    const s = keyDrillState(keySessionFixture(), { tries: [], answered: true, chosen: 'major' });
    expect(s.results[1]).toMatchObject({ result: 'wrong', correct: false, tries: 1 });
    expect(earSegments(s)[1]).toBe('wrong');
  });

  it('NEXT clears the hunt for the next phrase; 4 of 5 passes', () => {
    let s = keyDrillState(keySessionFixture(), { tries: [], answered: true });
    s = run(s, { type: 'NEXT' });
    expect(s.q).toBe(2);
    expect(s.root).toEqual({ found: false, tries: [] });
    expect(s.hinted).toBe(false);
    // Three more: two right, one wrong → 4 of 5.
    const answer = (st: EarDrillState, right: boolean): EarDrillState => {
      const q = st.questions[st.q];
      if (q?.match.type !== 'root' || q.match.then?.type !== 'choice') throw new Error('root');
      const mode = q.match.then.answer;
      return run(
        st,
        { type: 'PLAY_START', q: st.q, at: 0 },
        { type: 'PLAY_END', q: st.q, at: 1 },
        { type: 'ROOT_NOTE', midi: 60 + pcNumber(q.match.note) },
        { type: 'PICK', option: right ? mode : mode === 'major' ? 'minor' : 'major', at: 2 },
        { type: 'NEXT' },
      );
    };
    s = answer(answer(answer(s, true), true), false);
    expect(s.phase).toBe('done');
    expect(passed(s)).toBe(true);
  });
});

describe('keyModel — EarKey copy and lighting', () => {
  const session = keySessionFixture();
  const question = session.questions[1];
  const key = questionKey(question);

  it('reads the key and options from root.then', () => {
    expect(KEY_ORDER[1]).toBe('e-minor-1');
    expect(key).toEqual({ tonic: 'E', mode: 'minor' });
    expect(modeOptions(question)).toEqual(['major', 'minor']);
    expect(modeOptions(question).map((m) => modeLabel('E', m))).toEqual(earKeyFixture.answers);
    expect(modeLabel('Eb', 'minor')).toBe('E♭ minor');
  });

  it('step cards match EarKey:61–76 after G, then A, then E', () => {
    const s = keyDrillState(session, { tries: ['G', 'A'] });
    const [one, two] = earKeyFixture.steps;
    expect(stepOneCopy(s.root, key)).toEqual({
      state: one.state,
      title: one.title,
      body: one.body,
    });
    expect(stepTwoCopy(s.root, key, null)).toEqual({
      state: two.state,
      title: two.title,
      body: two.body,
    });
  });

  it('step 1 copy for first and second tries, and while hunting', () => {
    expect(stepOneCopy(keyDrillState(session, { tries: [] }).root, key).body).toBe('First try.');
    expect(stepOneCopy(keyDrillState(session, { tries: ['G'] }).root, key).body).toBe(
      'Found on your second try (you tried G).',
    );
    const h = stepOneCopy(keyDrillState(session, { tries: ['G'], found: false }).root, key);
    expect(h).toMatchObject({ state: 'current', title: 'Find the home note' });
    expect(h.body).toBe('Not G. Keep hunting — tries are unlimited.');
    expect(stepTwoCopy(keyDrillState(session, { found: false }).root, key, null).state).toBe(
      'upcoming',
    );
    expect(triesList(['G', 'A', 'B'])).toBe('G, A, then B');
  });

  it('home lights every octave of the tonic; tries sit in the octave played (EarKey:104–105)', () => {
    const s = keyDrillState(session, { tries: ['G', 'A'] });
    expect(keyboardStates(question, s.root)).toEqual({
      [G3]: 'tried',
      [A3]: 'tried',
      [E3]: 'home',
      [E4]: 'home',
    });
    const before = keyDrillState(session, { tries: ['G'], found: false });
    expect(keyboardStates(question, before.root)).toEqual({ [G3]: 'tried' });
  });

  it('answered feedback names the key and lights the tonic triad', () => {
    if (question === undefined) throw new Error('fixture');
    expect(keyFeedback(question, 'minor', true)).toEqual({
      title: 'E minor — yes.',
      body: "Home is E, and it's minor. Its home chord has a minor 3rd, so it sounds darker.",
    });
    const miss = keyFeedback(question, 'major', false);
    expect(miss.title).toBe('Not quite. That was E minor.');
    expect(miss.body).toMatch(/You said major — it will come back in review\.$/);
    // E minor triad E G B folded into C4–B4.
    expect(feedbackKeys(question)).toEqual({ 64: 'correct', 67: 'correct', 71: 'correct' });
  });
});
