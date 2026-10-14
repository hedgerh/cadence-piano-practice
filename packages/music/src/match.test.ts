// engine.md §1 match.ts / §1.T matcher table — HANDOFF §4 Match union, §5 MIDI rules.
import { describe, expect, it } from 'vitest';
import {
  type MatchInput,
  type MatchSpec,
  type MatchState,
  hintFor,
  initialMatchState,
  reduceMatch,
} from './match';
import { type Note, noteToMidi } from './pitch';
import { diatonicTriads } from './triads';
import { placeTriad } from './voicing';

const held = (...notes: Note[]): MatchInput => ({
  type: 'held',
  held: new Set(notes.map(noteToMidi)),
});
const noteOn = (note: Note): MatchInput => ({ type: 'noteOn', midi: noteToMidi(note) });
const choose = (option: string): MatchInput => ({ type: 'choose', option });

/** Run a list of inputs through the reducer and return every status seen. */
function run(spec: MatchSpec, inputs: MatchInput[]): { states: MatchState[]; last: MatchState } {
  const states: MatchState[] = [];
  let state = initialMatchState(spec);
  for (const input of inputs) {
    state = reduceMatch(spec, state, input);
    states.push(state);
  }
  return { states, last: state };
}

const stateOf = (spec: MatchSpec, input: MatchInput) =>
  reduceMatch(spec, initialMatchState(spec), input);
const statusOf = (spec: MatchSpec, input: MatchInput) =>
  reduceMatch(spec, initialMatchState(spec), input).status;

describe('initialMatchState', () => {
  it('is idle for every spec type', () => {
    const specs: MatchSpec[] = [
      { type: 'chord', notes: ['C', 'E', 'G'] },
      { type: 'voicing', notes: ['C4', 'E4', 'G4'] },
      { type: 'sequence', notes: ['C4', 'D4'] },
      { type: 'choice', answer: 'a', options: ['a', 'b'] },
      { type: 'root', note: 'C' },
      { type: 'progression', chords: [{ notes: ['C', 'E', 'G'] }], maxMove: 2 },
    ];
    for (const spec of specs) {
      expect(initialMatchState(spec)).toEqual({
        status: 'idle',
        index: 0,
        played: [],
        history: [],
        tooFar: [],
        tries: [],
        found: false,
        then: null,
        chosen: null,
      });
    }
  });
});

describe('chord — HANDOFF §5: held pitch-class set equals the target', () => {
  const cMajor: MatchSpec = { type: 'chord', notes: ['C', 'E', 'G'] };

  it('matcher table', () => {
    expect(statusOf(cMajor, held('E3', 'G3', 'C4'))).toBe('matched'); // inversion
    expect(statusOf(cMajor, held('C4', 'E4', 'G4', 'C5'))).toBe('matched'); // doubling
    expect(statusOf(cMajor, held('C4', 'E4'))).toBe('partial');
    expect(statusOf(cMajor, held('C4', 'E4', 'G4', 'A4'))).toBe('wrong');
    expect(statusOf(cMajor, held('C4', 'E4', 'G4'))).toBe('matched');
    expect(statusOf(cMajor, held())).toBe('idle');
    expect(statusOf(cMajor, held('D4'))).toBe('wrong');
  });

  it('spelling never affects grading: Cb is B', () => {
    const cb: MatchSpec = { type: 'chord', notes: ['Cb', 'Eb', 'Gb'] };
    expect(statusOf(cb, held('B3', 'D#4', 'F#4'))).toBe('matched');
  });

  it('ignores note-on and choose inputs', () => {
    const s = initialMatchState(cMajor);
    expect(reduceMatch(cMajor, s, noteOn('C4'))).toBe(s);
    expect(reduceMatch(cMajor, s, choose('x'))).toBe(s);
  });

  it('is recomputed from the held set each time (release goes back to idle)', () => {
    const { states } = run(cMajor, [held('C4', 'E4', 'G4'), held('C4'), held()]);
    expect(states.map((s) => s.status)).toEqual(['matched', 'partial', 'idle']);
  });
});

describe('voicing — exact MIDI set', () => {
  const root: MatchSpec = { type: 'voicing', notes: ['C4', 'E4', 'G4'] };

  it('rejects an inversion and an octave shift, accepts the exact notes', () => {
    expect(statusOf(root, held('C4', 'E4', 'G4'))).toBe('matched');
    expect(statusOf(root, held('E4', 'G4', 'C5'))).toBe('wrong');
    expect(statusOf(root, held('C3', 'E3', 'G3'))).toBe('wrong');
    expect(statusOf(root, held('C4', 'E4', 'G4', 'C5'))).toBe('wrong');
    expect(statusOf(root, held('C4', 'E4'))).toBe('partial');
    expect(statusOf(root, held())).toBe('idle');
  });

  it('ignores non-held inputs', () => {
    const s = initialMatchState(root);
    expect(reduceMatch(root, s, noteOn('C4'))).toBe(s);
  });
});

describe('sequence — ordered note-ons, wrong note resets silently', () => {
  const seq: MatchSpec = { type: 'sequence', notes: ['C4', 'D4', 'E4'] };

  it('advances through the target and matches on the last note', () => {
    const { states } = run(seq, [noteOn('C4'), noteOn('D4'), noteOn('E4')]);
    expect(states.map((s) => s.index)).toEqual([1, 2, 3]);
    expect(states.map((s) => s.status)).toEqual(['partial', 'partial', 'matched']);
  });

  it('a wrong note resets to the start with no wrong status', () => {
    const { last } = run(seq, [noteOn('C4'), noteOn('D4'), noteOn('F4')]);
    expect(last.index).toBe(0);
    expect(last.status).toBe('idle');
  });

  it('a wrong note equal to target[0] restarts at index 1', () => {
    const { last } = run(seq, [noteOn('C4'), noteOn('D4'), noteOn('C4')]);
    expect(last.index).toBe(1);
    expect(last.status).toBe('partial');
    const again = reduceMatch(seq, last, noteOn('D4'));
    expect(again.index).toBe(2);
  });

  it('is octave-strict by default and octave-free with anyOctave', () => {
    expect(stateOf(seq, noteOn('C5')).index).toBe(0);
    const any: MatchSpec = { type: 'sequence', notes: ['C4', 'D4', 'E4'], anyOctave: true };
    const { last } = run(any, [noteOn('C5'), noteOn('D3'), noteOn('E4')]);
    expect(last.status).toBe('matched');
  });

  it('stays matched and ignores held / choose inputs', () => {
    const { last } = run(seq, [noteOn('C4'), noteOn('D4'), noteOn('E4')]);
    expect(reduceMatch(seq, last, noteOn('F4'))).toBe(last);
    const s = initialMatchState(seq);
    expect(reduceMatch(seq, s, held('C4'))).toBe(s);
    expect(reduceMatch(seq, s, choose('x'))).toBe(s);
  });

  it('records the notes accepted so far, as played', () => {
    const any: MatchSpec = { type: 'sequence', notes: ['C4', 'D4', 'E4'], anyOctave: true };
    const { states } = run(any, [noteOn('C5'), noteOn('D5'), noteOn('F5')]);
    expect(states.map((s) => s.played)).toEqual([[72], [72, 74], []]);
  });

  describe('scales: anyOctave + direction keeps the run moving one way', () => {
    const up: MatchSpec = {
      type: 'sequence',
      notes: ['A3', 'B3', 'C4'],
      direction: 'up',
      anyOctave: true,
    };
    const down: MatchSpec = { ...up, notes: ['C4', 'B3', 'A3'], direction: 'down' };

    it('matches the run started in any octave', () => {
      expect(run(up, [noteOn('A4'), noteOn('B4'), noteOn('C5')]).last.status).toBe('matched');
      expect(run(down, [noteOn('C5'), noteOn('B4'), noteOn('A4')]).last.status).toBe('matched');
    });

    it('a right name in the wrong direction resets', () => {
      const { last } = run(up, [noteOn('A4'), noteOn('B3')]);
      expect(last.index).toBe(0);
      expect(last.status).toBe('idle');
      expect(run(down, [noteOn('C4'), noteOn('B4')]).last.index).toBe(0);
    });

    it('direction is ignored when the sequence is octave-strict', () => {
      const strict: MatchSpec = { type: 'sequence', notes: ['A3', 'B3'], direction: 'up' };
      expect(run(strict, [noteOn('A3'), noteOn('B3')]).last.status).toBe('matched');
    });
  });

  it('a one-note sequence matches on its note', () => {
    const one: MatchSpec = { type: 'sequence', notes: ['G4'] };
    expect(stateOf(one, noteOn('G4')).status).toBe('matched');
  });
});

describe('choice — string equality', () => {
  const spec: MatchSpec = { type: 'choice', answer: 'P5', options: ['P1', 'P5', 'P8'] };

  it('matches the answer, marks others wrong, records the pick', () => {
    expect(statusOf(spec, choose('P5'))).toBe('matched');
    const wrong = reduceMatch(spec, initialMatchState(spec), choose('P1'));
    expect(wrong.status).toBe('wrong');
    expect(wrong.chosen).toBe('P1');
  });

  it('ignores MIDI inputs and stays matched', () => {
    const s = initialMatchState(spec);
    expect(reduceMatch(spec, s, noteOn('C4'))).toBe(s);
    expect(reduceMatch(spec, s, held('C4'))).toBe(s);
    const matched = reduceMatch(spec, s, choose('P5'));
    expect(reduceMatch(spec, matched, choose('P1'))).toBe(matched);
  });
});

describe('root — tonic in any octave, then chain', () => {
  const plain: MatchSpec = { type: 'root', note: 'E' };
  const chained: MatchSpec = {
    type: 'root',
    note: 'E',
    then: { type: 'choice', answer: 'minor', options: ['major', 'minor'] },
  };

  it('matches the tonic in any octave; misses are recorded as tries', () => {
    expect(stateOf(plain, noteOn('E3')).status).toBe('matched');
    expect(stateOf(plain, noteOn('E5')).status).toBe('matched');
    const { states, last } = run(plain, [noteOn('G3'), noteOn('A3'), noteOn('E4')]);
    expect(states.map((s) => s.status)).toEqual(['wrong', 'wrong', 'matched']);
    expect(last.tries).toEqual([noteToMidi('G3'), noteToMidi('A3')]);
    expect(last.found).toBe(true);
  });

  it('with `then`, finding the tonic is partial and the chained match completes it', () => {
    const { states, last } = run(chained, [noteOn('E4'), choose('minor')]);
    expect(states.map((s) => s.status)).toEqual(['partial', 'matched']);
    expect(last.then?.chosen).toBe('minor');
  });

  it('a wrong chained answer reports wrong', () => {
    const { last } = run(chained, [noteOn('E4'), choose('major')]);
    expect(last.status).toBe('wrong');
    expect(last.found).toBe(true);
  });

  it('answers are ignored before the tonic is found; matched is terminal', () => {
    const s = initialMatchState(chained);
    expect(reduceMatch(chained, s, choose('minor'))).toBe(s);
    expect(reduceMatch(chained, s, held('E4'))).toBe(s);
    const { last } = run(plain, [noteOn('E4')]);
    expect(reduceMatch(plain, last, noteOn('F4'))).toBe(last);
  });
});

describe('hintFor — derived, never authored (HANDOFF §4)', () => {
  it('chord: spelled names in root/3rd/5th order, keys equal placeTriad', () => {
    const aMajor = diatonicTriads({ tonic: 'A', mode: 'major' });
    for (const t of aMajor) {
      const hint = hintFor({ type: 'chord', notes: [t.root, t.third, t.fifth] });
      expect(hint?.keys).toEqual(placeTriad(t));
    }
    expect(hintFor({ type: 'chord', notes: ['A', 'C#', 'E'] })).toEqual({
      names: ['A', 'C♯', 'E'],
      keys: [57, 61, 64],
    });
    expect(hintFor({ type: 'chord', notes: ['G#', 'B', 'D'] })?.names).toEqual(['G♯', 'B', 'D']);
    expect(hintFor({ type: 'chord', notes: [] })).toEqual({ names: [], keys: [] });
  });

  it('voicing and sequence: the authored notes', () => {
    expect(hintFor({ type: 'voicing', notes: ['E3', 'G3', 'C4'] })).toEqual({
      names: ['E', 'G', 'C'],
      keys: [52, 55, 60],
    });
    expect(hintFor({ type: 'sequence', notes: ['Bb3', 'C4'] })).toEqual({
      names: ['B♭', 'C'],
      keys: [58, 60],
    });
  });

  it('root: the tonic name and every octave of it on the practice keyboard', () => {
    expect(hintFor({ type: 'root', note: 'E' })).toEqual({ names: ['E'], keys: [52, 64] });
    expect(hintFor({ type: 'root', note: 'C#' })).toEqual({ names: ['C♯'], keys: [49, 61] });
  });

  it('choice: null (the hint is "hear it again")', () => {
    expect(hintFor({ type: 'choice', answer: 'a', options: ['a'] })).toBeNull();
  });
});

describe('chord with bass — a named inversion in any octave', () => {
  const firstInv: MatchSpec = { type: 'chord', notes: ['C', 'E', 'G'], bass: 'E' };
  it('matches when the bass is the lowest note, in any octave', () => {
    expect(statusOf(firstInv, held('E3', 'G3', 'C4'))).toBe('matched');
    expect(statusOf(firstInv, held('E4', 'G4', 'C5'))).toBe('matched');
  });
  it('the right notes over the wrong bass are wrong', () => {
    expect(statusOf(firstInv, held('C4', 'E4', 'G4'))).toBe('wrong');
  });
  it('the hint names the bass first and stacks above it', () => {
    expect(hintFor(firstInv)).toEqual({ names: ['E', 'G', 'C'], keys: [52, 55, 60] });
  });
});

// decisions.md 2026-10-10 "Voice leading": measured from the voicing the learner played.
describe('progression — chords in order, each voice moving at most maxMove', () => {
  const C: Note[] = ['C4', 'E4', 'G4'];
  const F: Note[] = ['C4', 'F4', 'A4'];
  const oneFourOne: MatchSpec = {
    type: 'progression',
    chords: [{ notes: ['C', 'E', 'G'] }, { notes: ['F', 'A', 'C'] }, { notes: ['C', 'E', 'G'] }],
    maxMove: 2,
  };

  it('advances chord by chord, and matches after the last', () => {
    const { states, last } = run(oneFourOne, [held(...C), held(...F), held(...C)]);
    expect(states.map((s) => s.status)).toEqual(['partial', 'partial', 'matched']);
    expect(states.map((s) => s.index)).toEqual([1, 2, 3]);
    expect(last.played).toEqual([60, 64, 67]);
  });

  it('a too-far jump is wrong and names the keys that moved too far; fixing it advances', () => {
    const { states } = run(oneFourOne, [held(...C), held('F3', 'A3', 'C4'), held(...F)]);
    expect(states[1]).toMatchObject({ status: 'wrong', index: 1, tooFar: [53, 57, 60] });
    expect(states[2]).toMatchObject({ status: 'partial', index: 2, tooFar: [] });
  });

  it('mid-change shapes are partial, letting go keeps your place, a stray note is wrong', () => {
    const { states } = run(oneFourOne, [
      held(...C),
      held('C4', 'G4'),
      held('C4', 'E4', 'F4', 'G4'),
      { type: 'held', held: new Set() },
      held('C#4'),
      held(...F),
    ]);
    expect(states.map((s) => s.status)).toEqual([
      'partial',
      'partial',
      'partial',
      'partial',
      'wrong',
      'partial',
    ]);
    expect(states[5]?.index).toBe(2);
  });

  it('the first chord can require an inversion', () => {
    const fromFirst: MatchSpec = {
      type: 'progression',
      chords: [{ notes: ['C', 'E', 'G'], bass: 'E' }, { notes: ['F', 'A', 'C'] }],
      maxMove: 2,
    };
    expect(statusOf(fromFirst, held(...C))).toBe('partial');
    expect(stateOf(fromFirst, held('E3', 'G3', 'C4')).index).toBe(1);
  });

  it('freeBass: a left-hand bass may jump; only the notes above it are measured', () => {
    const twoHands: MatchSpec = {
      type: 'progression',
      chords: [
        { notes: ['C', 'E', 'G'], bass: 'C' },
        { notes: ['F', 'A', 'C'], bass: 'F' },
      ],
      maxMove: 2,
      freeBass: true,
    };
    expect(run(twoHands, [held('C2', ...C), held('F2', ...F)]).last.status).toBe('matched');
    expect(run(twoHands, [held('C2', ...C), held(...F)]).last).toMatchObject({
      status: 'partial',
      index: 1,
    });
    expect(run(twoHands, [held('C2', ...C), held('F2', 'F3', 'A3', 'C4')]).last).toMatchObject({
      status: 'wrong',
      tooFar: [53, 57, 60],
    });
  });

  it('keeps every accepted voicing, in order, as the trail', () => {
    const { last } = run(oneFourOne, [held(...C), held(...F), held(...C)]);
    expect(last.history).toEqual([
      [60, 64, 67],
      [60, 65, 69],
      [60, 64, 67],
    ]);
  });

  // decisions.md 2026-10-14 "Progression help": a left-hand root in a one-hand drill.
  it('one hand: an extra left-hand root is set aside and the right hand is measured', () => {
    const { states, last } = run(oneFourOne, [
      held('C3', ...C),
      held('F2', ...F),
      held(...C), // the left hand may also drop out
    ]);
    expect(states.map((s) => s.index)).toEqual([1, 2, 3]);
    expect(last.status).toBe('matched');
    expect(states[1]?.played).toEqual([41, 60, 65, 69]);
    expect(stateOf(oneFourOne, held('C3', 'C4', 'E4', 'G4')).index).toBe(1);
  });

  it('one hand: the extra note must be the root, and the right hand still may not jump', () => {
    expect(statusOf(oneFourOne, held('E3', ...C))).toBe('partial');
    const jump = run(oneFourOne, [held('C3', ...C), held('F2', 'F3', 'A3', 'C4')]).last;
    expect(jump).toMatchObject({ status: 'wrong', tooFar: [53, 57, 60] });
  });

  it('one hand: an inversion is asked of the right hand, under any left-hand root', () => {
    const fromFirst: MatchSpec = {
      type: 'progression',
      chords: [{ notes: ['C', 'E', 'G'], bass: 'E' }, { notes: ['F', 'A', 'C'] }],
      maxMove: 2,
    };
    expect(stateOf(fromFirst, held('C3', 'E3', 'G3', 'C4')).index).toBe(1);
    expect(statusOf(fromFirst, held('C3', ...C))).toBe('partial');
  });

  it('the hint shows the next chord voiced nearest to what was played', () => {
    expect(hintFor(oneFourOne)).toEqual({ names: ['C', 'E', 'G'], keys: [60, 64, 67] });
    const afterI = stateOf(oneFourOne, held('C4', 'E4', 'G4'));
    expect(hintFor(oneFourOne, afterI)).toEqual({ names: ['F', 'A', 'C'], keys: [60, 65, 69] });
    const withRoot = stateOf(oneFourOne, held('C3', 'C4', 'E4', 'G4'));
    expect(hintFor(oneFourOne, withRoot)?.keys).toEqual([60, 65, 69]);
  });
});
