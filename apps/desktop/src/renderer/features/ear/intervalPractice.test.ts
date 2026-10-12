// decisions.md 2026-10-11 "Interval practice": free drill over picked intervals and directions.
import { noteToMidi } from '@cadence/music';
import { describe, expect, it } from 'vitest';
import {
  addToTally,
  DEFAULT_SETTINGS,
  feedbackFor,
  makeQuestion,
  nextQuestion,
  parseSettings,
  rootLabel,
  rootNote,
  toggleDirection,
  toggleInterval,
  toggleRoot,
  type PracticeQuestion,
  type PracticeSettings,
} from './intervalPractice';

/** A deterministic sequence in [0, 1). */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length] ?? 0;
};

describe('makeQuestion', () => {
  it('up and down play two notes 800 ms apart, with the ladder feedback sentence', () => {
    const up = makeQuestion('P4', 'up', 'C4');
    expect(up.sound).toEqual({ type: 'notes', notes: ['C4', 'F4'], gapMs: 800 });
    expect(up.explain).toBe("C up to F. 'Here Comes the Bride' — the first two notes.");
    const down = makeQuestion('m3', 'down', 'C5');
    expect(down.sound).toEqual({ type: 'notes', notes: ['C5', 'A4'], gapMs: 800 });
    expect(down.explain).toBe("C down to A. 'Hey Jude' — the first two notes.");
  });

  it('together plays both notes at once', () => {
    const q = makeQuestion('P5', 'together', 'D4');
    expect(q.sound).toEqual({ type: 'chord', notes: ['D4', 'A4'] });
    expect(q.explain).toMatch(/^D and A at once\. Going up: 'Twinkle/);
  });

  it('feedback keys fold into C4..B4', () => {
    expect(makeQuestion('P8', 'up', 'C4').keys).toEqual([60]);
    expect(makeQuestion('m3', 'down', 'C5').keys).toEqual([60, noteToMidi('A4')]);
  });
});

const settingsOf = (over: Partial<PracticeSettings>): PracticeSettings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});
const rootOf = (q: PracticeQuestion | null) =>
  q?.sound.type === 'notes' || q?.sound.type === 'chord' ? q.sound.notes[0] : undefined;

describe('nextQuestion', () => {
  it('every interval starts from C by default: C4 going up or together, C5 going down', () => {
    for (const d of ['up', 'together', 'down'] as const) {
      for (let i = 0; i < 10; i++) {
        const q = nextQuestion(settingsOf({ directions: [d] }), Math.random);
        expect(rootOf(q)).toBe(d === 'down' ? 'C5' : 'C4');
        expect(q?.rootPc).toBe(0);
      }
    }
  });

  it('draws only the picked intervals, directions and roots', () => {
    const s = settingsOf({ intervals: ['m3', 'P5'], directions: ['down'], roots: [0, 7] });
    for (let i = 0; i < 20; i++) {
      const q = nextQuestion(s, Math.random);
      expect(['m3', 'P5']).toContain(q?.interval);
      expect(q?.direction).toBe('down');
      expect(['C5', 'G5']).toContain(rootOf(q));
    }
  });

  it('never repeats the same interval and direction when there is a choice', () => {
    const s = settingsOf({ intervals: ['P1', 'P5'] });
    let prev: PracticeQuestion | null = null;
    for (let i = 0; i < 20; i++) {
      const q = nextQuestion(s, Math.random, prev);
      if (prev) expect(q?.interval).not.toBe(prev.interval);
      prev = q;
    }
    // One pair only: it repeats.
    const only = settingsOf({ intervals: ['P5'] });
    const first = nextQuestion(only, seq(0));
    expect(nextQuestion(only, seq(0), first)?.interval).toBe('P5');
  });

  it('nothing picked → no question', () => {
    expect(nextQuestion(settingsOf({ intervals: [] }), Math.random)).toBeNull();
  });
});

describe('settings', () => {
  it('toggles keep their order; the last direction and the last root stay on', () => {
    const s = toggleInterval(DEFAULT_SETTINGS, 'M2');
    expect(s.intervals).toEqual(['P1', 'M2', 'm3', 'M3', 'P5', 'P8']);
    expect(toggleInterval(s, 'M2').intervals).toEqual(DEFAULT_SETTINGS.intervals);
    expect(toggleDirection(DEFAULT_SETTINGS, 'up')).toBe(DEFAULT_SETTINGS);
    const both = toggleDirection(DEFAULT_SETTINGS, 'together');
    expect(both.directions).toEqual(['up', 'together']);
    expect(toggleDirection(both, 'up').directions).toEqual(['together']);
    expect(toggleRoot(DEFAULT_SETTINGS, 0)).toBe(DEFAULT_SETTINGS);
    expect(toggleRoot(toggleRoot(DEFAULT_SETTINGS, 7), 2).roots).toEqual([0, 2, 7]);
  });

  it('roots: labels and where each direction starts', () => {
    expect([0, 1, 3, 11].map(rootLabel)).toEqual(['C', 'C♯', 'E♭', 'B']);
    expect(rootNote(7, 'up')).toBe('G4');
    expect(rootNote(7, 'down')).toBe('G5');
  });

  it('parses saved settings, dropping anything unknown; older saves start from C', () => {
    expect(parseSettings(null)).toBeNull();
    expect(parseSettings('not json')).toBeNull();
    expect(
      parseSettings('{"intervals":["P5","XX","P1"],"directions":["down","sideways"]}'),
    ).toEqual({ intervals: ['P1', 'P5'], directions: ['down'], roots: [0] });
    expect(
      parseSettings('{"intervals":["P5"],"directions":["up"],"roots":[7,"x",2,40]}')?.roots,
    ).toEqual([2, 7]);
    expect(parseSettings('{"intervals":["P5"],"directions":[]}')).toBeNull();
  });
});

describe('tally and feedback', () => {
  it('counts right answers per interval', () => {
    let t = addToTally({}, 'm3', true);
    t = addToTally(t, 'm3', false);
    expect(t.m3).toEqual({ right: 1, total: 2 });
  });

  it('feedback names the interval; a miss says what you picked (no review: nothing is saved)', () => {
    const q = makeQuestion('P8', 'up', 'C4');
    expect(feedbackFor(q, 'P8', true).title).toBe('Octave — yes.');
    const miss = feedbackFor(q, 'P5', false);
    expect(miss.title).toBe('Not quite. That was an octave.');
    expect(miss.body).toMatch(/You said perfect 5th\.$/);
    expect(feedbackFor(makeQuestion('P1', 'up', 'C4'), 'm2', false).title).toBe(
      'Not quite. That was a unison.',
    );
  });
});
