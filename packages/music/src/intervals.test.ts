// engine.md §1 intervals.ts
import { describe, expect, it } from 'vitest';
import { INTERVALS, intervalBetween, intervalById, transpose } from './intervals';

describe('INTERVALS', () => {
  it('is the 13 simple intervals in semitone order', () => {
    expect(INTERVALS.map((i) => i.id)).toEqual([
      'P1',
      'm2',
      'M2',
      'm3',
      'M3',
      'P4',
      'TT',
      'P5',
      'm6',
      'M6',
      'm7',
      'M7',
      'P8',
    ]);
    expect(INTERVALS.map((i) => i.semitones)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(INTERVALS.map((i) => i.name)).toEqual([
      'Unison',
      'Minor 2nd',
      'Major 2nd',
      'Minor 3rd',
      'Major 3rd',
      'Perfect 4th',
      'Tritone',
      'Perfect 5th',
      'Minor 6th',
      'Major 6th',
      'Minor 7th',
      'Major 7th',
      'Octave',
    ]);
  });

  it('intervalById', () => {
    expect(intervalById('P4')).toEqual({ id: 'P4', name: 'Perfect 4th', semitones: 5 });
    expect(() => intervalById('P9' as never)).toThrow(RangeError);
  });
});

describe('intervalBetween', () => {
  it('ignores direction and folds compound intervals', () => {
    expect(intervalBetween(60, 67).id).toBe('P5');
    expect(intervalBetween(67, 60).id).toBe('P5');
    expect(intervalBetween(60, 60).id).toBe('P1');
    expect(intervalBetween(60, 72).id).toBe('P8');
    expect(intervalBetween(60, 66).id).toBe('TT');
    expect(intervalBetween(60, 73).id).toBe('m2');
    expect(intervalBetween(60, 84).id).toBe('P8');
  });
});

describe('transpose', () => {
  it('moves by semitones and spells per the spelling', () => {
    expect(transpose('C4', 7)).toBe('G4');
    expect(transpose('C4', -1)).toBe('B3');
    expect(transpose('C4', 12)).toBe('C5');
    expect(transpose('C4', 1)).toBe('C#4');
    expect(transpose('C4', 1, 'flats')).toBe('Db4');
    expect(transpose('C4', 3)).toBe('Eb4');
    expect(transpose('C4', 3, 'sharps')).toBe('D#4');
    expect(transpose('Gb3', 5, { key: { tonic: 'Gb', mode: 'major' } })).toBe('Cb4');
  });
});
