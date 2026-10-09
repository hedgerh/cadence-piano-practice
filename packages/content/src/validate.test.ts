// engine.md §2.3 validator — each broken fixture yields exactly one error whose `path`
// points at the fault (docs/tasks/02-content.md Acceptance).
import { describe, expect, it } from 'vitest';
import { buildTracks } from './index';
import { at } from './testUtils';
import type { Track } from './types';
import { validateTracks } from './validate';

// Tracks are found by id so adding a track never shifts these fixtures; error paths use the
// track's index in buildTracks() (`T.major`, `T.minor`, `T.ear`).
const ids = buildTracks().map((t) => t.id);
const indexOf = (id: string): number => {
  const i = ids.indexOf(id);
  if (i < 0) throw new Error(`no track ${id}`);
  return i;
};
const T = {
  major: indexOf('major-diatonic-chords'),
  minor: indexOf('minor-diatonic-chords'),
  scales: indexOf('minor-scales'),
  ear: indexOf('ear-training'),
};

function broken(mutate: (tracks: Track[]) => void): Track[] {
  const tracks = structuredClone(buildTracks());
  mutate(tracks);
  return tracks;
}

const aMajor = (t: Track[]) => at(at(t, T.major).levels, 3);
const ear = (t: Track[]) => at(t, T.ear);
const intervalsL1 = (t: Track[]) => at(at(ear(t).stages, 0).levels, 0);

function expectOneError(tracks: Track[], path: string): void {
  const errors = validateTracks(tracks);
  expect(errors).toHaveLength(1);
  expect(errors[0]?.path).toBe(path);
  expect(errors[0]?.message).toBeTruthy();
}

describe('validateTracks negatives', () => {
  it('a non-diatonic note (C natural in A major I)', () => {
    const tracks = broken((t) => {
      const d1 = at(aMajor(t).steps, 0);
      d1.match = { type: 'chord', notes: ['A', 'C', 'E'] };
    });
    expectOneError(tracks, `tracks[${T.major}].levels[3].steps[0].match.notes[1]`);
  });

  it('a misspelled note (Db for C# in A major I)', () => {
    const tracks = broken((t) => {
      at(aMajor(t).steps, 0).match = { type: 'chord', notes: ['A', 'Db', 'E'] };
    });
    expectOneError(tracks, `tracks[${T.major}].levels[3].steps[0].match.notes[1]`);
  });

  it('a duplicate step id', () => {
    const tracks = broken((t) => {
      at(aMajor(t).steps, 1).id = 'd1';
    });
    expectOneError(tracks, `tracks[${T.major}].levels[3].steps[1].id`);
  });

  it('a duplicate level id across tracks', () => {
    const tracks = broken((t) => {
      at(at(t, T.scales).levels, 0).id = 'a-minor';
    });
    expectOneError(tracks, `tracks[${T.scales}].levels[0].id`);
  });

  it('an out-of-range note', () => {
    const tracks = broken((t) => {
      at(intervalsL1(t).pool, 0).play = { type: 'notes', notes: ['C4', 'C9'], gapMs: 800 };
    });
    expectOneError(tracks, `tracks[${T.ear}].stages[0].levels[0].pool[0].play.notes[1]`);
  });

  it('a missing unlock target', () => {
    const tracks = broken((t) => {
      at(ear(t).stages, 1).unlock = { stage: 'nope', level: 4 };
    });
    expectOneError(tracks, `tracks[${T.ear}].stages[1].unlock.stage`);
  });

  it('an unlock level past the end of its target', () => {
    const tracks = broken((t) => {
      at(ear(t).stages, 1).unlock = { stage: 'intervals', level: 8 };
    });
    expectOneError(tracks, `tracks[${T.ear}].stages[1].unlock.level`);
  });

  it('an unlock cycle', () => {
    const tracks = broken((t) => {
      at(ear(t).stages, 1).unlock = { stage: 'chord-quality', level: 1 };
      at(ear(t).stages, 2).unlock = { stage: 'scale-degrees', level: 1 };
    });
    expectOneError(tracks, `tracks[${T.ear}].stages[1].unlock`);
  });

  it('choice.answer not in options', () => {
    const tracks = broken((t) => {
      const step = at(intervalsL1(t).pool, 0);
      if (step.match.type !== 'choice') throw new Error('expected choice');
      step.match = { ...step.match, answer: 'XX' };
    });
    expectOneError(tracks, `tracks[${T.ear}].stages[0].levels[0].pool[0].match.answer`);
  });

  it('a pool answer that is not an active option', () => {
    const tracks = broken((t) => {
      intervalsL1(t).activeOptions = ['P1', 'P5'];
    });
    expectOneError(tracks, `tracks[${T.ear}].stages[0].levels[0].pool[2].match.answer`);
  });

  it('a phrase without 8 notes', () => {
    const tracks = broken((t) => {
      const step = at(at(at(ear(t).stages, 4).levels, 0).pool, 0);
      if (step.play?.type !== 'phrase') throw new Error('expected phrase');
      step.play = { type: 'phrase', notes: step.play.notes.slice(0, 7) };
    });
    expectOneError(tracks, `tracks[${T.ear}].stages[4].levels[0].pool[0].play.notes`);
  });

  it('circle levels out of order (G and D swapped)', () => {
    const tracks = broken((t) => {
      const levels = at(t, T.major).levels ?? [];
      const [g, d] = [at(levels, 1), at(levels, 2)];
      levels[1] = d;
      levels[2] = g;
    });
    expect(validateTracks(tracks).map((e) => e.path)).toEqual([
      `tracks[${T.major}].levels[1].key.tonic`,
      `tracks[${T.major}].levels[2].key.tonic`,
    ]);
  });

  it('a lesson chip with the wrong quality', () => {
    const tracks = broken((t) => {
      const chip = at(at(at(t, T.minor).lesson?.rows, 1).chips, 2);
      chip.quality = 'minor';
    });
    expectOneError(tracks, `tracks[${T.minor}].lesson.rows[1].chips[2].quality`);
  });

  it('a malformed note fails the schema with a path', () => {
    const tracks = broken((t) => {
      at(intervalsL1(t).pool, 0).play = {
        type: 'notes',
        notes: ['C4', 'H4' as 'C4'],
        gapMs: 800,
      };
    });
    expectOneError(tracks, `tracks[${T.ear}].stages[0].levels[0].pool[0].play.notes[1]`);
  });
});
