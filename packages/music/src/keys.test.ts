// engine.md §1 keys.ts / §1.T — all 24 keys' scales and signatures, hand tables for
// C, A, Gb, B major and A, Eb, G# minor.
import { describe, expect, it } from 'vitest';
import {
  ALL_KEYS,
  CIRCLE_MAJOR,
  CIRCLE_MINOR,
  type Key,
  keySignature,
  keySignatureText,
  keySlug,
  keyTitle,
  relativeMajor,
  relativeMinor,
  scale,
} from './keys';
import { MODE_OFFSETS, midiToPc, parsePitchClass, pcNumber } from './pitch';

const major = (tonic: Key['tonic']): Key => ({ tonic, mode: 'major' });
const minor = (tonic: Key['tonic']): Key => ({ tonic, mode: 'minor' });

describe('circle of fifths', () => {
  it('matches the design spellings', () => {
    expect(CIRCLE_MAJOR).toEqual(['C', 'G', 'D', 'A', 'E', 'B', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F']);
    expect(CIRCLE_MINOR).toEqual(['A', 'E', 'B', 'F#', 'C#', 'G#', 'Eb', 'Bb', 'F', 'C', 'G', 'D']);
    expect(ALL_KEYS).toHaveLength(24);
  });

  it('each minor is the relative of the major at the same position and vice versa', () => {
    CIRCLE_MAJOR.forEach((tonic, i) => {
      expect(relativeMinor(major(tonic))).toEqual(minor(CIRCLE_MINOR[i] as Key['tonic']));
      expect(relativeMajor(minor(CIRCLE_MINOR[i] as Key['tonic']))).toEqual(major(tonic));
    });
    expect(relativeMinor(minor('A'))).toEqual(minor('A'));
    expect(relativeMajor(major('C'))).toEqual(major('C'));
  });
});

describe('scale', () => {
  it('hand tables', () => {
    expect(scale(major('C'))).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(scale(major('A'))).toEqual(['A', 'B', 'C#', 'D', 'E', 'F#', 'G#']);
    expect(scale(major('Gb'))).toEqual(['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F']);
    expect(scale(major('B'))).toEqual(['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#']);
    expect(scale(minor('A'))).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(scale(minor('Eb'))).toEqual(['Eb', 'F', 'Gb', 'Ab', 'Bb', 'Cb', 'Db']);
    expect(scale(minor('G#'))).toEqual(['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#']);
  });

  it('all 24 keys: seven distinct letters in order and the mode step pattern', () => {
    for (const key of ALL_KEYS) {
      const notes = scale(key);
      expect(notes).toHaveLength(7);
      const letters = notes.map((n) => parsePitchClass(n).letter);
      expect(new Set(letters).size).toBe(7);
      const tonic = pcNumber(key.tonic);
      expect(notes.map(pcNumber)).toEqual(MODE_OFFSETS[key.mode].map((o) => midiToPc(tonic + o)));
    }
  });
});

describe('keySignature', () => {
  it('counts for all 24 keys', () => {
    const majors = [0, 1, 2, 3, 4, 5, -6, -5, -4, -3, -2, -1];
    const minors = [0, 1, 2, 3, 4, 5, -6, -5, -4, -3, -2, -1];
    CIRCLE_MAJOR.forEach((tonic, i) => {
      const sig = keySignature(major(tonic));
      const n = majors[i] ?? 0;
      expect([sig.sharps, sig.flats]).toEqual([Math.max(n, 0), Math.max(-n, 0)]);
      expect(sig.accidentals).toHaveLength(Math.abs(n));
    });
    CIRCLE_MINOR.forEach((tonic, i) => {
      const sig = keySignature(minor(tonic));
      const n = minors[i] ?? 0;
      expect([sig.sharps, sig.flats]).toEqual([Math.max(n, 0), Math.max(-n, 0)]);
    });
  });

  it('lists accidentals in signature order', () => {
    expect(keySignature(major('A')).accidentals).toEqual(['F#', 'C#', 'G#']);
    expect(keySignature(major('Gb')).accidentals).toEqual(['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);
    expect(keySignature(minor('G#')).accidentals).toEqual(['F#', 'C#', 'G#', 'D#', 'A#']);
    expect(keySignature(major('C'))).toEqual({ sharps: 0, flats: 0, accidentals: [] });
  });

  it('keySignatureText', () => {
    expect(keySignatureText(major('A'))).toBe('Three sharps: F♯, C♯, G♯.');
    expect(keySignatureText(major('C'))).toBe('No sharps or flats.');
    expect(keySignatureText(minor('A'))).toBe('No sharps or flats.');
    expect(keySignatureText(major('Bb'))).toBe('Two flats: B♭, E♭.');
    expect(keySignatureText(major('G'))).toBe('One sharp: F♯.');
    expect(keySignatureText(major('F'))).toBe('One flat: B♭.');
    expect(keySignatureText(minor('Eb'))).toBe('Six flats: B♭, E♭, A♭, D♭, G♭, C♭.');
    expect(keySignatureText(major('B'))).toBe('Five sharps: F♯, C♯, G♯, D♯, A♯.');
  });
});

describe('titles and slugs', () => {
  it('keyTitle renders ♯/♭', () => {
    expect(keyTitle(minor('Eb'))).toBe('E♭ minor');
    expect(keyTitle(major('A'))).toBe('A major');
    expect(keyTitle(minor('F#'))).toBe('F♯ minor');
  });

  it('keySlug is lowercase ascii with s for sharp', () => {
    expect(keySlug(major('A'))).toBe('a-major');
    expect(keySlug(minor('Eb'))).toBe('eb-minor');
    expect(keySlug(minor('F#'))).toBe('fs-minor');
    expect(keySlug(major('Gb'))).toBe('gb-major');
    expect(new Set(ALL_KEYS.map(keySlug)).size).toBe(24);
  });
});
