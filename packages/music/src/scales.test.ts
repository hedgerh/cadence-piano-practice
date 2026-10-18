// decisions.md 2026-10-18 "Pentatonic and blues scales".
import { describe, expect, it } from 'vitest';
import { bluesScale, flatFive, majorPentatonic, minorPentatonic, placeRun } from './scales';
import { noteToMidi } from './pitch';
import { PRACTICE_RANGE } from './voicing';
import { CIRCLE_MAJOR, CIRCLE_MINOR } from './keys';

describe('pentatonic and blues scales', () => {
  it('C major pentatonic is A minor pentatonic from A', () => {
    expect(majorPentatonic({ tonic: 'C', mode: 'major' })).toEqual(['C', 'D', 'E', 'G', 'A']);
    expect(minorPentatonic({ tonic: 'A', mode: 'minor' })).toEqual(['A', 'C', 'D', 'E', 'G']);
  });

  it('the blues scale adds the flat 5th, spelled on the 5th’s letter where it can be', () => {
    expect(bluesScale({ tonic: 'A', mode: 'minor' })).toEqual(['A', 'C', 'D', 'Eb', 'E', 'G']);
    expect(flatFive({ tonic: 'E', mode: 'minor' })).toBe('Bb');
    expect(flatFive({ tonic: 'G#', mode: 'minor' })).toBe('D');
    expect(flatFive({ tonic: 'Eb', mode: 'minor' })).toBe('A');
  });

  it('runs stay on the practice keyboard in every key', () => {
    for (const tonic of CIRCLE_MAJOR) {
      const run = placeRun(majorPentatonic({ tonic, mode: 'major' })).map(noteToMidi);
      expect(run).toHaveLength(6);
      expect(Math.max(...run)).toBeLessThanOrEqual(PRACTICE_RANGE.high);
    }
    for (const tonic of CIRCLE_MINOR) {
      const run = placeRun(bluesScale({ tonic, mode: 'minor' })).map(noteToMidi);
      expect(run).toHaveLength(7);
      expect(run.every((m, i) => i === 0 || m > (run[i - 1] ?? 0))).toBe(true);
      expect(Math.max(...run)).toBeLessThanOrEqual(PRACTICE_RANGE.high);
    }
    expect(placeRun(['A', 'C', 'D', 'Eb', 'E', 'G'])).toEqual([
      'A3',
      'C4',
      'D4',
      'Eb4',
      'E4',
      'G4',
      'A4',
    ]);
  });
});
