// decisions.md 2026-10-11 "Interval practice": free drill over picked intervals and directions.
import { noteToMidi } from '@cadence/music';
import { describe, expect, it } from 'vitest';
import {
  addToTally,
  DEFAULT_SETTINGS,
  DOWN_ROOTS,
  feedbackFor,
  makeQuestion,
  nextQuestion,
  parseSettings,
  toggleDirection,
  toggleInterval,
  UP_ROOTS,
  type PracticeQuestion,
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

describe('nextQuestion', () => {
  it('draws only the picked intervals and directions, with a root for the direction', () => {
    const settings = { intervals: ['m3' as const, 'P5' as const], directions: ['down' as const] };
    for (let i = 0; i < 20; i++) {
      const q = nextQuestion(settings, Math.random);
      expect(['m3', 'P5']).toContain(q?.interval);
      expect(q?.direction).toBe('down');
      const root = q?.sound.type === 'notes' ? q.sound.notes[0] : undefined;
      expect(DOWN_ROOTS).toContain(root);
    }
    const up = nextQuestion({ intervals: ['M2'], directions: ['up'] }, Math.random);
    expect(UP_ROOTS).toContain(up?.sound.type === 'notes' ? up.sound.notes[0] : undefined);
  });

  it('never repeats the same interval and direction when there is a choice', () => {
    const settings = { intervals: ['P1' as const, 'P5' as const], directions: ['up' as const] };
    let prev: PracticeQuestion | null = null;
    for (let i = 0; i < 20; i++) {
      const q = nextQuestion(settings, Math.random, prev);
      if (prev) expect(q?.interval).not.toBe(prev.interval);
      prev = q;
    }
    // One pair only: it repeats.
    const only = { intervals: ['P5' as const], directions: ['up' as const] };
    const first = nextQuestion(only, seq(0));
    expect(nextQuestion(only, seq(0), first)?.interval).toBe('P5');
  });

  it('nothing picked → no question', () => {
    expect(nextQuestion({ intervals: [], directions: ['up'] }, Math.random)).toBeNull();
  });
});

describe('settings', () => {
  it('toggles keep interval order; the last direction stays on', () => {
    const s = toggleInterval(DEFAULT_SETTINGS, 'M2');
    expect(s.intervals).toEqual(['P1', 'M2', 'm3', 'M3', 'P5', 'P8']);
    expect(toggleInterval(s, 'M2').intervals).toEqual(DEFAULT_SETTINGS.intervals);
    expect(toggleDirection(DEFAULT_SETTINGS, 'up')).toBe(DEFAULT_SETTINGS);
    const both = toggleDirection(DEFAULT_SETTINGS, 'together');
    expect(both.directions).toEqual(['up', 'together']);
    expect(toggleDirection(both, 'up').directions).toEqual(['together']);
  });

  it('parses saved settings, dropping anything unknown', () => {
    expect(parseSettings(null)).toBeNull();
    expect(parseSettings('not json')).toBeNull();
    expect(
      parseSettings('{"intervals":["P5","XX","P1"],"directions":["down","sideways"]}'),
    ).toEqual({ intervals: ['P1', 'P5'], directions: ['down'] });
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
