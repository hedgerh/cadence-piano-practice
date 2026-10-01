// docs/engine.md §5 Practice reducer and §6 defaults 1–7 (HANDOFF §5 practice loop).
import { keyLevel } from '@cadence/content';
import { noteToMidi, type Midi, type Note } from '@cadence/music';
import { describe, expect, it } from 'vitest';
import {
  doneCount,
  durationMs,
  HINT_LABELS,
  initialPracticeState,
  practiceReducer,
  type PracticeAction,
  type PracticeSession,
  type PracticeState,
} from './practiceReducer';
import {
  chordShort,
  chordStates,
  eyebrowFor,
  finishCopy,
  hintNames,
  keyboardStates,
  markPlayedMode,
  progressSegments,
} from './practiceSelectors';
import { withRetry } from './retry';

const level = keyLevel({ tonic: 'A', mode: 'major' });
const steps = level.steps.map((s) => ({ ...s, lastResult: null, dueOn: null, intervalDays: 0 }));

function session(results: PracticeSession['results'] = []): PracticeSession {
  return {
    sessionId: 's1',
    trackId: 'major-diatonic-chords',
    trackTitle: 'Major diatonic chords',
    levelId: level.id,
    levelTitle: level.title,
    shortTitle: level.title,
    stageTitle: null,
    kind: 'learn',
    isEar: false,
    planBlockId: null,
    startedAt: 0,
    finishedAt: null,
    resumed: results.length > 0,
    visibility: 'all',
    pass: null,
    steps,
    questions: [],
    results,
  };
}

const recorded = (ordinal: number, result: 'clean' | 'skipped' = 'clean') => ({
  ordinal,
  stepId: `d${ordinal + 1}`,
  result,
  hintLevel: 0,
  chosen: null,
  tries: null,
  playedBack: false,
  elapsedMs: 5000,
});

const held = (...notes: Note[]): ReadonlySet<Midi> => new Set(notes.map(noteToMidi));
const press = (at: number, ...notes: Note[]): PracticeAction => ({
  type: 'HELD_CHANGED',
  held: held(...notes),
  at,
});
const releaseAll = (at: number): PracticeAction => ({ type: 'HELD_CHANGED', held: new Set(), at });

/** The seven A major triads in root position (Practice:140–146). */
const CHORDS: Note[][] = [
  ['A3', 'C#4', 'E4'],
  ['B3', 'D4', 'F#4'],
  ['C#4', 'E4', 'G#4'],
  ['D3', 'F#3', 'A3'],
  ['E3', 'G#3', 'B3'],
  ['F#3', 'A3', 'C#4'],
  ['G#3', 'B3', 'D4'],
];

const run = (
  actions: readonly PracticeAction[],
  from: PracticeState = initialPracticeState(session()),
) => actions.reduce(practiceReducer, from);

/** Play chord `i`, let the flash finish, advance, release. */
function playAndAdvance(i: number, at: number): PracticeAction[] {
  return [
    press(at, ...(CHORDS[i] ?? [])),
    { type: 'FLASH_DONE' },
    { type: 'ADVANCE', at: at + 600 },
    releaseAll(at + 700),
  ];
}

describe('practiceReducer — match → matched → advancing → next (engine.md §5)', () => {
  it('a held chord matches, flashes the played keys, then advances on FLASH_DONE + ADVANCE', () => {
    let s = run([press(1000, 'A3', 'C#4', 'E4')]);
    expect(s.phase).toBe('matched');
    expect(s.results).toEqual([
      { ordinal: 0, stepId: 'd1', result: 'clean', hintLevel: 0, elapsedMs: 0 },
    ]);
    expect(keyboardStates(s)).toEqual({ 57: 'correct', 61: 'correct', 64: 'correct' });
    s = practiceReducer(s, { type: 'FLASH_DONE' });
    expect(s.phase).toBe('advancing');
    s = practiceReducer(s, { type: 'ADVANCE', at: 1600 });
    expect(s).toMatchObject({ phase: 'listening', current: 1, hint: 0, flash: [] });
    expect(keyboardStates(s)).toEqual({});
  });

  it.each<[string, Note[], 'matched' | 'listening']>([
    ['root position', ['A3', 'C#4', 'E4'], 'matched'],
    ['first inversion', ['C#4', 'E4', 'A4'], 'matched'],
    ['doubled root', ['A3', 'C#4', 'E4', 'A4'], 'matched'],
    ['other octave', ['A2', 'C#3', 'E3'], 'matched'],
    ['partial', ['A3', 'C#4'], 'listening'],
    ['extra note', ['A3', 'C#4', 'E4', 'F#4'], 'listening'],
    ['wrong chord', ['B3', 'D4', 'F#4'], 'listening'],
  ])('HANDOFF §5 chord matching: %s → %s', (_label, notes, phase) => {
    expect(run([press(0, ...notes)]).phase).toBe(phase);
  });

  it('FLASH_DONE / ADVANCE are ignored outside their phase', () => {
    const s = initialPracticeState(session());
    expect(practiceReducer(s, { type: 'FLASH_DONE' })).toBe(s);
    expect(practiceReducer(s, { type: 'ADVANCE', at: 1 })).toBe(s);
  });
});

describe('practiceReducer — armed gating (engine.md §6.6)', () => {
  it('a chord still held from the previous step does not match until every key is released', () => {
    // I and ii share no notes, so hold ii's notes on top of I without releasing.
    let s = run([
      press(0, 'A3', 'C#4', 'E4'),
      { type: 'FLASH_DONE' },
      { type: 'ADVANCE', at: 600 },
    ]);
    expect(s).toMatchObject({ current: 1, armed: false });
    s = run([press(700, 'B3', 'D4', 'F#4')], s); // released I, but never to zero keys
    expect(s).toMatchObject({ phase: 'listening', armed: false, results: [expect.anything()] });
    s = run([releaseAll(800)], s);
    expect(s.armed).toBe(true);
    s = run([press(900, 'B3', 'D4', 'F#4')], s);
    expect(s.phase).toBe('matched');
    expect(s.results[1]).toMatchObject({ ordinal: 1, result: 'clean' });
  });

  it('a step reached while nothing is held starts armed', () => {
    const s = run(playAndAdvance(0, 0));
    expect(s).toMatchObject({ current: 1, armed: true, phase: 'listening' });
  });
});

describe('practiceReducer — hint ladder (Practice:192, engine.md §5)', () => {
  it.each([
    [0, 'Give me a hint'],
    [1, 'Show it on the keys'],
    [2, 'That is all the hints'],
  ])('hint %i label is "%s"', (hint, label) => {
    expect(HINT_LABELS[hint]).toBe(label);
  });

  it('HINT climbs to 2 and stops; 1 shows note names, 2 lights the target keys tangerine', () => {
    const h1 = run([{ type: 'HINT', at: 0 }]);
    expect(h1.hint).toBe(1);
    expect(hintNames(h1)).toEqual(['A', 'C♯', 'E']);
    expect(keyboardStates(h1)).toEqual({});
    const h2 = run([{ type: 'HINT', at: 1 }], h1);
    expect(h2.hint).toBe(2);
    // voicing.ts hint placement: A3 C♯4 E4
    expect(keyboardStates(h2)).toEqual({ 57: 'hint', 61: 'hint', 64: 'hint' });
    expect(practiceReducer(h2, { type: 'HINT', at: 2 })).toBe(h2);
  });

  it('a match after a hint resolves `hinted` with the hint level, and the hint resets', () => {
    const s = run([{ type: 'HINT', at: 0 }, { type: 'HINT', at: 1 }, ...playAndAdvance(0, 2)]);
    expect(s.results[0]).toMatchObject({ result: 'hinted', hintLevel: 2 });
    expect(s.hint).toBe(0);
  });
});

describe('practiceReducer — skip and mark as played (engine.md §6.1–6.2)', () => {
  it('first skip queues the step to the end; the second skip resolves `skipped`', () => {
    let s = run([{ type: 'SKIP', at: 0 }]);
    expect(s).toMatchObject({ current: 1, queue: [0], skippedOnce: [0], results: [] });
    expect(chordStates(s).slice(0, 2)).toEqual(['skipped', 'current']);
    for (let i = 1; i < 7; i++) s = run(playAndAdvance(i, i * 1000), s);
    expect(s).toMatchObject({ phase: 'listening', current: 0, queue: [] });
    expect(chordStates(s)[0]).toBe('current');
    s = run([{ type: 'SKIP', at: 9000 }], s);
    expect(s.phase).toBe('finished');
    expect(s.results.at(-1)).toMatchObject({ ordinal: 0, result: 'skipped' });
    expect(doneCount(s)).toBe(6);
    expect(progressSegments(s)[0]).toBe('empty');
    expect(chordStates(s)[0]).toBe('skipped');
  });

  it('a queued step played on its return resolves clean', () => {
    let s = run([{ type: 'SKIP', at: 0 }]);
    for (let i = 1; i < 7; i++) s = run(playAndAdvance(i, i * 1000), s);
    s = run(playAndAdvance(0, 9000), s);
    expect(s.phase).toBe('finished');
    expect(s.results.map((r) => r.result)).toEqual(Array(7).fill('clean'));
  });

  it('skipping the only remaining step brings it straight back', () => {
    let s = initialPracticeState(session([0, 1, 2, 3, 4, 5].map((o) => recorded(o))));
    s = run([{ type: 'SKIP', at: 0 }], s);
    expect(s).toMatchObject({ phase: 'listening', current: 6, queue: [] });
  });

  it('MARK_PLAYED resolves `marked` (keeping the hint level) and advances immediately', () => {
    const s = run([
      { type: 'HINT', at: 0 },
      { type: 'MARK_PLAYED', at: 2500 },
    ]);
    expect(s.results).toEqual([
      { ordinal: 0, stepId: 'd1', result: 'marked', hintLevel: 1, elapsedMs: 2500 },
    ]);
    expect(s).toMatchObject({ phase: 'listening', current: 1, hint: 0 });
    expect(chordStates(s)[0]).toBe('done');
  });

  it('actions are ignored during the flash and after finishing', () => {
    const matched = run([press(0, 'A3', 'C#4', 'E4')]);
    for (const type of ['HINT', 'SKIP', 'MARK_PLAYED'] as const) {
      expect(practiceReducer(matched, { type, at: 1 })).toBe(matched);
    }
    const done = initialPracticeState(session([0, 1, 2, 3, 4, 5, 6].map((o) => recorded(o))));
    expect(practiceReducer(done, { type: 'SKIP', at: 1 })).toBe(done);
  });
});

describe('practiceReducer — timer (engine.md §6.7)', () => {
  it('does not start on visibility changes or releases', () => {
    const s = run([{ type: 'SET_VIS', vis: 'num' }, releaseAll(5)]);
    expect(s.timer.startedAt).toBeNull();
    expect(s.vis).toBe('num');
  });

  it.each<[string, PracticeAction]>([
    ['first note-on', press(1234, 'A3')],
    ['first hint', { type: 'HINT', at: 1234 }],
    ['first skip', { type: 'SKIP', at: 1234 }],
    ['first mark', { type: 'MARK_PLAYED', at: 1234 }],
  ])('starts on the %s', (_label, action) => {
    expect(run([action]).timer.startedAt).toBe(1234);
  });

  it('stops on the last resolve; duration adds time from resumed results', () => {
    let s = initialPracticeState(session([0, 1, 2, 3, 4].map((o) => recorded(o))));
    expect(s.timer.baseMs).toBe(25_000);
    s = run([press(10_000, 'F#3', 'A3', 'C#4'), { type: 'FLASH_DONE' }], s);
    s = run([{ type: 'ADVANCE', at: 10_600 }, releaseAll(10_700)], s);
    s = run([press(14_000, 'G#3', 'B3', 'D4')], s);
    expect(s.timer.stoppedAt).toBe(14_000);
    expect(s.results.at(-1)).toMatchObject({ ordinal: 6, elapsedMs: 3400 });
    s = run([{ type: 'FLASH_DONE' }, { type: 'ADVANCE', at: 14_600 }], s);
    expect(s.phase).toBe('finished');
    expect(durationMs(s, 99_999)).toBe(25_000 + 4000);
  });
});

describe('practiceReducer — finish and resume', () => {
  it('finishes when the order and the queue are exhausted', () => {
    let s = initialPracticeState(session());
    for (let i = 0; i < 7; i++) s = run(playAndAdvance(i, i * 1000), s);
    expect(s.phase).toBe('finished');
    expect(doneCount(s)).toBe(7);
    expect(finishCopy(s, 'A major')).toEqual({
      title: 'All seven. Nice.',
      body: 'A major is in your hands now.',
    });
    expect(keyboardStates(s)).toEqual({});
    expect(hintNames(s)).toEqual([]);
  });

  it('resumes at the first unresolved step with done/skipped preserved', () => {
    const s = initialPracticeState(session([recorded(0), recorded(1, 'skipped'), recorded(3)]));
    expect(s).toMatchObject({ phase: 'listening', current: 2, order: [4, 5, 6] });
    expect(chordStates(s)).toEqual([
      'done',
      'skipped',
      'current',
      'done',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(progressSegments(s)).toEqual([
      'done',
      'empty',
      'current',
      'done',
      'empty',
      'empty',
      'empty',
    ]);
  });

  it('a fully recorded session opens finished; finish copy adapts to skips', () => {
    const s = initialPracticeState(
      session(
        [0, 1, 2, 3, 4, 5, 6].map((o) => recorded(o, o === 6 || o === 1 ? 'skipped' : 'clean')),
      ),
    );
    expect(s.phase).toBe('finished');
    expect(finishCopy(s, 'A major')).toEqual({
      title: 'Five of seven. Nice.',
      body: 'Bm and G♯° come back tomorrow.',
    });
    const one = initialPracticeState(
      session([0, 1, 2, 3, 4, 5, 6].map((o) => recorded(o, o === 6 ? 'skipped' : 'clean'))),
    );
    expect(finishCopy(one, 'A major').body).toBe('G♯° comes back tomorrow.');
  });
});

describe('practice selectors', () => {
  it('chordShort reproduces Practice:140–146', () => {
    expect(steps.map(chordShort)).toEqual(['A', 'Bm', 'C♯m', 'D', 'E', 'F♯m', 'G♯°']);
  });

  it('eyebrow: kind + track topic (Practice:29)', () => {
    expect(eyebrowFor({ kind: 'learn', trackTitle: 'Major diatonic chords' })).toEqual({
      text: 'Learn · diatonic chords',
      tone: 'tangerine',
    });
    expect(eyebrowFor({ kind: 'review', trackTitle: 'Minor diatonic chords' }).text).toBe(
      'Review · diatonic chords',
    );
  });

  it.each<[Parameters<typeof markPlayedMode>[0], boolean, string]>([
    [{ kind: 'connected', deviceName: 'X', deviceId: 'x' }, false, 'hidden'],
    [{ kind: 'connected', deviceName: 'X', deviceId: 'x' }, true, 'text'],
    [{ kind: 'requesting' }, false, 'text'],
    [{ kind: 'no-device' }, false, 'promoted'],
    [{ kind: 'denied' }, false, 'promoted'],
    [{ kind: 'unsupported' }, false, 'promoted'],
  ])('engine.md §6.3 mark-as-played: %o (always=%s) → %s', (status, always, mode) => {
    expect(markPlayedMode(status, always)).toBe(mode);
  });
});

describe('withRetry (recordStep posts)', () => {
  const noWait = () => Promise.resolve();

  it('retries until it succeeds', async () => {
    let calls = 0;
    const fn = () => (++calls < 3 ? Promise.reject(new Error('busy')) : Promise.resolve('ok'));
    await expect(withRetry(fn, [1, 1, 1], noWait)).resolves.toBe('ok');
    expect(calls).toBe(3);
  });

  it('gives up after the last delay and rethrows', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.reject(new Error('down'));
    };
    await expect(withRetry(fn, [1, 1], noWait)).rejects.toThrow('down');
    expect(calls).toBe(3);
  });
});
