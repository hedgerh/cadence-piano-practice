// engine.md §1 triads.ts / §1.T — diatonic triads for all 24 keys with hand tables for
// C, A, Gb, B major and A, Eb, G# minor (Eb minor → Ebm F° Gb Abm Bbm Cb Db).
import { describe, expect, it } from 'vitest';
import { ALL_KEYS, type Key } from './keys';
import { pcNumber, pretty } from './pitch';
import {
  MAJOR_NUMERALS,
  MINOR_NUMERALS,
  diatonicTriads,
  numeralFor,
  triadName,
  triadQuality,
  triadShort,
} from './triads';

const major = (tonic: Key['tonic']): Key => ({ tonic, mode: 'major' });
const minor = (tonic: Key['tonic']): Key => ({ tonic, mode: 'minor' });
const shorts = (key: Key): string[] => diatonicTriads(key).map((t) => t.short);
// Hand tables are written in ASCII; `short` renders ♯/♭.
const asciiShorts = (s: string): string[] => s.split(' ').map(pretty);

describe('diatonicTriads hand tables', () => {
  it('C major → C Dm Em F G Am B°', () => {
    expect(shorts(major('C'))).toEqual(asciiShorts('C Dm Em F G Am B°'));
  });
  it('A major → A Bm C#m D E F#m G#° (Practice.dc.html lines 140–146)', () => {
    expect(shorts(major('A'))).toEqual(asciiShorts('A Bm C#m D E F#m G#°'));
    expect(diatonicTriads(major('A')).map((t) => t.name)).toEqual([
      'A major',
      'B minor',
      'C♯ minor',
      'D major',
      'E major',
      'F♯ minor',
      'G♯ diminished',
    ]);
  });
  it('Gb major → Gb Abm Bbm Cb Db Ebm F°', () => {
    expect(shorts(major('Gb'))).toEqual(asciiShorts('Gb Abm Bbm Cb Db Ebm F°'));
  });
  it('B major → B C#m D#m E F# G#m A#°', () => {
    expect(shorts(major('B'))).toEqual(asciiShorts('B C#m D#m E F# G#m A#°'));
  });
  it('A minor → Am B° C Dm Em F G', () => {
    expect(shorts(minor('A'))).toEqual(asciiShorts('Am B° C Dm Em F G'));
  });
  it('Eb minor → Ebm F° Gb Abm Bbm Cb Db', () => {
    expect(shorts(minor('Eb'))).toEqual(asciiShorts('Ebm F° Gb Abm Bbm Cb Db'));
    expect(shorts(minor('Eb'))).toEqual(['E♭m', 'F°', 'G♭', 'A♭m', 'B♭m', 'C♭', 'D♭']);
  });
  it('G# minor → G#m A#° B C#m D#m E F#', () => {
    expect(shorts(minor('G#'))).toEqual(asciiShorts('G#m A#° B C#m D#m E F#'));
  });
});

describe('diatonicTriads for all 24 keys', () => {
  it('numerals equal the mode table and qualities follow it', () => {
    const majorQ = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
    const minorQ = ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'];
    for (const key of ALL_KEYS) {
      const triads = diatonicTriads(key);
      expect(triads).toHaveLength(7);
      expect(triads.map((t) => t.numeral)).toEqual(
        key.mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS,
      );
      expect(triads.map((t) => t.quality)).toEqual(key.mode === 'major' ? majorQ : minorQ);
      triads.forEach((t, i) => {
        expect(t.degree).toBe(i + 1);
        expect(t.pcs).toEqual([pcNumber(t.root), pcNumber(t.third), pcNumber(t.fifth)]);
        expect(t.name).toBe(triadName(t.root, t.quality));
        expect(t.short).toBe(triadShort(t.root, t.quality));
      });
    }
  });

  it('numeral tables', () => {
    expect(MAJOR_NUMERALS).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(MINOR_NUMERALS).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
    expect(numeralFor(1, 'major')).toBe('I');
    expect(numeralFor(2, 'minor')).toBe('ii');
    expect(numeralFor(7, 'diminished')).toBe('vii°');
    expect(() => numeralFor(8, 'major')).toThrow(RangeError);
  });
});

describe('triadQuality / triadName / triadShort', () => {
  it('quality from (3rd, 5th) semitones', () => {
    expect(triadQuality(0, 4, 7)).toBe('major');
    expect(triadQuality(0, 3, 7)).toBe('minor');
    expect(triadQuality(11, 2, 5)).toBe('diminished');
    expect(() => triadQuality(0, 4, 8)).toThrow(RangeError);
  });
  it('names render ♯/♭', () => {
    expect(triadName('G#', 'diminished')).toBe('G♯ diminished');
    expect(triadName('B', 'minor')).toBe('B minor');
    expect(triadShort('C#', 'minor')).toBe('C♯m');
    expect(triadShort('G#', 'diminished')).toBe('G♯°');
    expect(triadShort('D', 'major')).toBe('D');
  });
});
