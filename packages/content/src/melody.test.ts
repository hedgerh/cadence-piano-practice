// decisions.md 2026-10-17 "Melody tracks": Arpeggios & chord tones and Melody echo — 12 major
// keys each; arpeggios and echoes are `shape` sequences, chord tones one note per chord.
import { CIRCLE_MAJOR, type Key, type Note, noteToMidi, pcNumber, scale } from '@cadence/music';
import { describe, expect, it } from 'vitest';
import { ECHO_LENGTH, type EchoTier, echoPhrase } from './generators/phrase';
import { buildTracks, stepNoun, validateTracks } from './index';
import { at, trackById } from './testUtils';
import type { Track } from './types';

const tracks = buildTracks();
const arps = trackById(tracks, 'arpeggios');
const echo = trackById(tracks, 'melody-echo');
const C: Key = { tonic: 'C', mode: 'major' };

describe('arpeggios', () => {
  it('12 major keys around the circle, in the Melody group, 8 steps each', () => {
    expect(arps.group).toBe('Melody');
    expect(arps.levels?.map((l) => l.key?.tonic)).toEqual([...CIRCLE_MAJOR]);
    expect(arps.levels?.every((l) => l.steps.length === 8)).toBe(true);
    expect(at(arps.levels, 0).id).toBe('c-major-arpeggios');
  });

  it('C major: I, IV, V and vi up to the octave and back, then chord tones', () => {
    const steps = at(arps.levels, 0).steps;
    expect(steps.map((s) => s.label)).toEqual([
      'I',
      'IV',
      'V',
      'vi',
      'Roots',
      '3rds',
      '5ths',
      '3rds',
    ]);
    expect(steps[0]?.match).toEqual({
      type: 'sequence',
      notes: ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4'],
      shape: true,
    });
    expect(steps[3]?.match).toMatchObject({ notes: ['A4', 'C5', 'E5', 'A5', 'E5', 'C5', 'A4'] });
    expect(steps[0]?.hint).toMatchObject({
      type: 'notes',
      notes: steps[0]?.match.type === 'sequence' ? steps[0].match.notes : [],
    });
    expect(steps.slice(4).map((s) => (s.match.type === 'sequence' ? s.match.notes : []))).toEqual([
      ['C4', 'F4', 'G4', 'C4'],
      ['E4', 'A4', 'B4', 'E4'],
      ['G4', 'C4', 'D4', 'G4'],
      ['E4', 'B4', 'C4', 'A4'],
    ]);
    expect(steps[4]?.match).toMatchObject({ anyOctave: true });
    expect(steps[7]?.name).toBe('3rds of I–V–vi–IV');
    expect(steps[7]?.parts?.map((p) => `${p.label} ${p.sub ?? ''}`)).toEqual([
      'I C',
      'V G',
      'vi Am',
      'IV F',
    ]);
  });

  it('spells with the key: E♭ major uses flats', () => {
    const eb = arps.levels?.find((l) => l.key?.tonic === 'Eb');
    expect(eb?.steps[0]?.match).toMatchObject({
      notes: ['Eb4', 'G4', 'Bb4', 'Eb5', 'Bb4', 'G4', 'Eb4'],
    });
  });

  it('levels are called arpeggios', () => {
    const level = at(arps.levels, 0);
    expect(level.noun).toBe('arpeggio');
    expect(stepNoun(level.steps, level.noun)).toBe('arpeggio');
    expect(stepNoun(level.steps)).toBe('scale');
  });
});

describe('melody echo', () => {
  it('12 keys, 8 phrases each, every phrase played first and graded by shape', () => {
    expect(echo.group).toBe('Melody');
    expect(echo.levels?.map((l) => l.id).slice(0, 2)).toEqual(['c-major-echo', 'g-major-echo']);
    for (const level of echo.levels ?? []) {
      expect(level.noun).toBe('phrase');
      expect(level.steps.map((s) => s.id)).toEqual([
        'e1',
        'e2',
        'e3',
        'e4',
        'e5',
        'e6',
        'e7',
        'e8',
      ]);
      const lengths = level.steps.map((s) =>
        s.match.type === 'sequence' ? s.match.notes.length : 0,
      );
      expect(lengths).toEqual([3, 3, 4, 4, 5, 5, 5, 5]);
      for (const s of level.steps) {
        if (s.match.type !== 'sequence') throw new Error('echo steps are sequences');
        expect(s.match.shape).toBe(true);
        expect(s.play).toEqual({ type: 'notes', notes: s.match.notes, gapMs: 600 });
      }
      const phrases = level.steps.map((s) =>
        s.match.type === 'sequence' ? s.match.notes.join(' ') : '',
      );
      expect(new Set(phrases).size).toBe(8);
    }
  });

  it('names never give the notes away', () => {
    expect(at(echo.levels, 0).steps.map((s) => s.name)).toEqual([
      'Echo 1 · three notes',
      'Echo 2 · three notes',
      'Echo 3 · four notes',
      'Echo 4 · four notes',
      'Echo 5 · five notes',
      'Echo 6 · five notes',
      'Echo 7 · five notes',
      'Echo 8 · five notes',
    ]);
    expect(at(echo.levels, 0).note).toMatch(/\*\*C\*\*/);
  });
});

describe('echoPhrase', () => {
  const degree = (key: Key, n: Note) =>
    scale(key).findIndex((pc) => pcNumber(pc) === noteToMidi(n) % 12);
  const keys = CIRCLE_MAJOR.map((tonic): Key => ({ tonic, mode: 'major' }));

  it('is deterministic per seed', () => {
    expect(echoPhrase(C, 'x/e1', 3)).toEqual(echoPhrase(C, 'x/e1', 3));
  });

  it('follows each tier in every key, over many seeds', () => {
    for (const key of keys) {
      for (let i = 0; i < 25; i++) {
        for (const tier of [1, 2, 3, 4] as EchoTier[]) {
          const p = echoPhrase(key, `${key.tonic}/${tier}/${i}`, tier);
          const midi = p.map(noteToMidi);
          const moves = midi.slice(1).map((m, k) => m - (midi[k] ?? 0));
          const degrees = p.map((n) => degree(key, n));
          expect(p).toHaveLength(ECHO_LENGTH[tier]);
          expect(midi.every((m) => m >= 55 && m <= 79)).toBe(true);
          if (tier <= 2) expect(degrees[0]).toBe(0);
          else expect([0, 2, 4]).toContain(degrees[0]);
          if (tier === 1) expect(moves.every((m) => m !== 0 && Math.abs(m) <= 2)).toBe(true);
          if (tier === 2 || tier === 3) expect(degrees[degrees.length - 1]).toBe(0);
          if (tier === 3) expect(moves.every((m) => m !== 0 && Math.abs(m) <= 4)).toBe(true);
          if (tier === 4) {
            const leaps = moves.filter((m) => Math.abs(m) >= 5);
            expect(leaps).toHaveLength(1);
            expect([0, 2, 4]).toContain(degrees[degrees.length - 1]);
          }
        }
      }
    }
  });

  it('never repeats a phrase it is told to avoid', () => {
    const first = echoPhrase(C, 'c/e1', 1);
    expect(echoPhrase(C, 'c/e1', 1, [first])).not.toEqual(first);
  });
});

describe('validator: melody rules', () => {
  const withLevel = (edit: (t: Track) => void): Track[] => {
    const copy = structuredClone(tracks);
    const t = copy.find((x) => x.id === 'melody-echo');
    if (!t) throw new Error('missing melody-echo');
    edit(t);
    return copy;
  };

  it('flags a repeated phrase, a shape off the keyboard and parts of the wrong length', () => {
    const errors = validateTracks(
      withLevel((t) => {
        const level = at(t.levels, 0);
        const [a, b] = level.steps;
        if (a?.play && b) {
          b.match = structuredClone(a.match);
          b.play = structuredClone(a.play);
        }
        const c = level.steps[2];
        if (c?.match.type === 'sequence') c.match.notes = ['C6', 'D6', 'E6', 'D6'];
        const d = level.steps[3];
        if (d) d.parts = [{ label: 'I' }];
      }),
    ).map((e) => e.message);
    expect(errors).toContain('phrase repeated in c-major-echo');
    expect(errors).toContain('C6 is outside C3..B5');
    expect(errors).toContain('parts are one chip per chord of a progression or note of a sequence');
  });
});
