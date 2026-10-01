// engine.md §2.2 Phrases — mulberry32 seeded from a hash of the step key; 8 notes from the
// key's scale; start on 1 or 5; ≥3 chord tones; range 55..79; L1–L2 end on the tonic.
import { type Key, noteToMidi, pcNumber, scale } from '@cadence/music';
import { describe, expect, it } from 'vitest';
import { hashString, mulberry32, phrase } from './generators/phrase';
import { buildTracks } from './index';
import { at, stageById, trackById } from './testUtils';

const ear = trackById(buildTracks(), 'ear-training');
const findKey = stageById(ear, 'find-the-key');

function degreeOf(key: Key, note: string): number {
  const pcs = scale(key).map(pcNumber);
  return pcs.indexOf(noteToMidi(note as `C${number}`) % 12) + 1;
}

describe('mulberry32 / hashString', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = mulberry32(hashString('c-major/1'));
    const b = mulberry32(hashString('c-major/1'));
    const xs = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

describe('phrase', () => {
  it('is the same on two builds', () => {
    const key: Key = { tonic: 'E', mode: 'minor' };
    expect(phrase(key, 'find-the-key-1/e-minor-1', 'tonic')).toEqual(
      phrase(key, 'find-the-key-1/e-minor-1', 'tonic'),
    );
    const again = stageById(trackById(buildTracks(), 'ear-training'), 'find-the-key');
    expect(again).toEqual(findKey);
  });

  it('different seeds give different phrases', () => {
    const key: Key = { tonic: 'C', mode: 'major' };
    expect(phrase(key, 'x/1', 'tonic')).not.toEqual(phrase(key, 'x/2', 'tonic'));
  });

  findKey.levels.forEach((level, li) => {
    it(`${level.id}: every phrase obeys the rules`, () => {
      for (const step of level.pool ?? []) {
        if (step.play?.type !== 'phrase' || step.match.type !== 'root') {
          throw new Error('expected phrase + root');
        }
        const then = step.match.then;
        if (then?.type !== 'choice') throw new Error('expected then choice');
        const key: Key = { tonic: step.match.note, mode: then.answer as Key['mode'] };
        const notes = step.play.notes;
        expect(notes).toHaveLength(8);
        const names = scale(key);
        const degrees = notes.map((n) => degreeOf(key, n));
        for (const n of notes) {
          const m = noteToMidi(n);
          expect(m).toBeGreaterThanOrEqual(55);
          expect(m).toBeLessThanOrEqual(79);
          expect(names).toContain(n.replace(/-?\d+$/, ''));
        }
        expect([1, 5]).toContain(degrees[0]);
        // Moves are a scale step, a diatonic 3rd (≤ 4 semitones) or a repeat.
        notes.slice(1).forEach((n, i) => {
          const prev = at(notes, i);
          expect(Math.abs(noteToMidi(n) - noteToMidi(prev))).toBeLessThanOrEqual(4);
        });
        expect(degrees.filter((d) => d === 1 || d === 3 || d === 5).length).toBeGreaterThanOrEqual(
          3,
        );
        const last = degrees[degrees.length - 1];
        if (li < 2) expect(last).toBe(1);
        else expect([3, 5]).toContain(last);
      }
    });
  });
});
