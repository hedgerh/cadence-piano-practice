// engine.md §1 voicing.ts / §1.T — placeTriad reproduces the design voicings
// (Practice.dc.html lines 140–146).
import { describe, expect, it } from 'vitest';
import { ALL_KEYS, type Key } from './keys';
import { midiToPc, noteToMidi, pcNumber } from './pitch';
import { diatonicTriads } from './triads';
import {
  PRACTICE_RANGE,
  cadenceVoicing,
  placeRoot,
  placeScale,
  placeTriad,
  stackAbove,
  triadNotes,
} from './voicing';

const major = (tonic: Key['tonic']): Key => ({ tonic, mode: 'major' });
const minor = (tonic: Key['tonic']): Key => ({ tonic, mode: 'minor' });
const triad = (key: Key, degree: number) => {
  const t = diatonicTriads(key)[degree - 1];
  if (!t) throw new Error('no triad');
  return t;
};

describe('placeRoot', () => {
  it('places every pitch class in D3 (50) .. C#4 (61)', () => {
    expect(placeRoot(2)).toBe(50); // D
    expect(placeRoot(1)).toBe(61); // C#
    expect(placeRoot(0)).toBe(60); // C
    expect(placeRoot(9)).toBe(57); // A
    for (let pc = 0; pc < 12; pc++) {
      const m = placeRoot(pc);
      expect(m).toBeGreaterThanOrEqual(50);
      expect(m).toBeLessThanOrEqual(61);
      expect(midiToPc(m)).toBe(pc);
    }
  });
});

describe('stackAbove', () => {
  it('stacks each pitch class strictly above the previous note', () => {
    expect(stackAbove(60, [4, 7])).toEqual([60, 64, 67]);
    expect(stackAbove(57, [1, 4])).toEqual([57, 61, 64]);
    expect(stackAbove(60, [0])).toEqual([60, 72]);
    expect(stackAbove(60, [])).toEqual([60]);
  });
});

describe('placeTriad', () => {
  it('reproduces the design voicings', () => {
    expect(placeTriad(triad(major('A'), 1))).toEqual([57, 61, 64]); // A3 C#4 E4
    expect(placeTriad(triad(major('A'), 4))).toEqual([50, 54, 57]); // D3 F#3 A3
    expect(placeTriad(triad(major('A'), 3))).toEqual([61, 64, 68]); // C#4 E4 G#4
    expect(placeTriad(triad(major('A'), 7))).toEqual([56, 59, 62]); // G#3 B3 D4
  });

  it('matches all seven A major design key sets via triadNotes', () => {
    const design = [
      ['A3', 'C#4', 'E4'],
      ['B3', 'D4', 'F#4'],
      ['C#4', 'E4', 'G#4'],
      ['D3', 'F#3', 'A3'],
      ['E3', 'G#3', 'B3'],
      ['F#3', 'A3', 'C#4'],
      ['G#3', 'B3', 'D4'],
    ];
    expect(diatonicTriads(major('A')).map(triadNotes)).toEqual(design);
  });

  it('spells Cb / E# style notes from the triad itself', () => {
    expect(triadNotes(triad(major('Gb'), 4))).toEqual(['Cb4', 'Eb4', 'Gb4']);
    expect(triadNotes(triad(minor('Eb'), 1))).toEqual(['Eb3', 'Gb3', 'Bb3']);
  });

  it('stays inside the practice range for all 168 diatonic triads', () => {
    for (const key of ALL_KEYS) {
      for (const t of diatonicTriads(key)) {
        const [r, th, f] = placeTriad(t);
        expect(r).toBeGreaterThanOrEqual(PRACTICE_RANGE.low);
        expect(f).toBeLessThanOrEqual(PRACTICE_RANGE.high);
        expect(th).toBeGreaterThan(r);
        expect(f).toBeGreaterThan(th);
        expect([r, th, f].map(midiToPc)).toEqual(t.pcs);
        expect(triadNotes(t).map(noteToMidi)).toEqual([r, th, f]);
      }
    }
  });
});

describe('placeScale', () => {
  it('is eight ascending notes tonic → tonic within the keyboard', () => {
    expect(placeScale(major('C'))).toEqual(['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4']);
    expect(placeScale(minor('A'))).toEqual(['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4']);
    expect(placeScale(major('Gb'))).toEqual([
      'Gb3',
      'Ab3',
      'Bb3',
      'Cb4',
      'Db4',
      'Eb4',
      'F4',
      'Gb4',
    ]);
    for (const key of ALL_KEYS) {
      const midis = placeScale(key).map(noteToMidi);
      expect(midis).toHaveLength(8);
      expect(midis[0]).toBeGreaterThanOrEqual(PRACTICE_RANGE.low);
      expect(midis[7]).toBeLessThanOrEqual(PRACTICE_RANGE.high);
      expect(midis[7]).toBe((midis[0] ?? 0) + 12);
      for (let i = 1; i < 8; i++) expect(midis[i]).toBeGreaterThan(midis[i - 1] ?? 0);
    }
  });
});

describe('cadenceVoicing', () => {
  it('C major: I root, IV second inversion, V first inversion, I — with bass roots', () => {
    expect(cadenceVoicing(major('C'))).toEqual([
      [48, 60, 64, 67], // C2.. C4 E4 G4
      [53, 60, 65, 69], // F3 · C4 F4 A4
      [55, 59, 62, 67], // G3 · B3 D4 G4
      [48, 60, 64, 67],
    ]);
  });

  it('A minor uses the natural-minor v (subtonic G)', () => {
    expect(cadenceVoicing(minor('A'))).toEqual([
      [45, 57, 60, 64],
      [50, 57, 62, 65],
      [52, 55, 59, 64],
      [45, 57, 60, 64],
    ]);
  });

  it('every key: four chords, each bass = chord root − 12, pitch classes = I IV V I', () => {
    for (const key of ALL_KEYS) {
      const chords = cadenceVoicing(key);
      const [I, IV, V] = [triad(key, 1), triad(key, 4), triad(key, 5)];
      const expectRoots = [I, IV, V, I];
      expect(chords).toHaveLength(4);
      chords.forEach((chord, i) => {
        const t = expectRoots[i];
        if (!t) throw new Error('missing triad');
        expect(chord).toHaveLength(4);
        const [bass, ...upper] = chord;
        expect(midiToPc(bass ?? -1)).toBe(pcNumber(t.root));
        expect(upper).toContain((bass ?? 0) + 12);
        expect(new Set(upper.map(midiToPc))).toEqual(new Set(t.pcs));
        for (let k = 1; k < chord.length; k++) {
          expect(chord[k]).toBeGreaterThan(chord[k - 1] ?? 0);
        }
      });
    }
  });
});
