// decisions.md 2026-10-10 "Voice leading": motion pairs voices low to high; the nearest voicing
// keeps common tones; paths stay on the practice keyboard.
import { describe, expect, it } from 'vitest';
import { PRACTICE_RANGE } from './voicing';
import {
  nextVoicing,
  placeBass,
  placeChord,
  rotateToBass,
  smoothestVoicing,
  voiceLead,
  voiceMotion,
} from './voiceLeading';

const I = { pcs: [0, 4, 7] }; // C E G
const IV = { pcs: [5, 9, 0] }; // F A C
const V = { pcs: [7, 11, 2] }; // G B D

describe('voiceMotion', () => {
  it('pairs voices low to high, whatever order they come in', () => {
    expect(voiceMotion([60, 64, 67], [69, 60, 65])).toEqual([0, 1, 2]);
    expect(voiceMotion([60, 64, 67], [53, 57, 60])).toEqual([-7, -7, -7]);
  });
  it('is null when the voice counts differ', () => {
    expect(voiceMotion([60, 64, 67], [60, 64])).toBeNull();
  });
});

describe('placing chords', () => {
  it('rotateToBass puts the named chord tone first', () => {
    expect(rotateToBass([0, 4, 7], 7)).toEqual([7, 0, 4]);
    expect(rotateToBass([0, 4, 7])).toEqual([0, 4, 7]);
    expect(() => rotateToBass([0, 4, 7], 2)).toThrow(RangeError);
  });
  it('placeChord stacks close position from the bass placed in D3..C♯4', () => {
    expect(placeChord(I)).toEqual([60, 64, 67]);
    expect(placeChord({ pcs: [0, 4, 7], bass: 4 })).toEqual([52, 55, 60]); // E3 G3 C4
  });
  it('placeBass keeps the left hand in C2..B2', () => {
    expect(placeBass(0)).toBe(36);
    expect(placeBass(11)).toBe(47);
  });
});

describe('smoothestVoicing', () => {
  it('I → IV keeps the shared C and moves the others by step', () => {
    expect(smoothestVoicing([60, 64, 67], IV)).toEqual([60, 65, 69]);
  });
  it('I → V keeps the shared G', () => {
    expect(smoothestVoicing([60, 64, 67], V)).toEqual([59, 62, 67]);
  });
  it('honours a required bass', () => {
    expect(smoothestVoicing([60, 64, 67], { pcs: [5, 9, 0], bass: 5 })).toEqual([65, 69, 72]);
  });
  it('falls back to the hint placement with nothing to lead from', () => {
    expect(smoothestVoicing([], IV)).toEqual(placeChord(IV));
  });
});

describe('nextVoicing / voiceLead', () => {
  it('with freeBass, the bass sits in C2..B2 and only the notes above are led', () => {
    expect(nextVoicing(null, { ...I, bass: 0 }, true)).toEqual([36, 60, 64, 67]);
    expect(nextVoicing([36, 60, 64, 67], { ...IV, bass: 5 }, true)).toEqual([41, 60, 65, 69]);
  });

  it('I–IV–V–I moves every voice at most 2 semitones and stays on the keyboard', () => {
    const path = voiceLead([I, IV, V, I]);
    expect(path).toEqual([
      [48, 52, 55],
      [48, 53, 57],
      [50, 55, 59],
      [52, 55, 60],
    ]);
    for (let i = 1; i < path.length; i++) {
      const moves = voiceMotion(path[i - 1] ?? [], path[i] ?? []) ?? [];
      expect(Math.max(...moves.map(Math.abs))).toBeLessThanOrEqual(2);
    }
    const all = path.flat();
    expect(Math.min(...all)).toBeGreaterThanOrEqual(PRACTICE_RANGE.low);
    expect(Math.max(...all)).toBeLessThanOrEqual(PRACTICE_RANGE.high);
  });

  it('shifting a two-hand path to fit moves the upper voices, never the bass', () => {
    const path = voiceLead(
      [
        { ...I, bass: 0 },
        { ...IV, bass: 5 },
        { ...V, bass: 7 },
        { ...I, bass: 0 },
      ],
      true,
    );
    expect(path.map((v) => v[0])).toEqual([36, 41, 43, 36]);
    expect(path[0]).toEqual([36, 48, 52, 55]);
  });
});
