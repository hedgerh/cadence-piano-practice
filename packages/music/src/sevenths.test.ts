// decisions.md 2026-10-18 "7th chords": the diatonic 7ths of a key, their symbols, and hint
// placement that keeps four notes on the practice keyboard.
import { describe, expect, it } from 'vitest';
import { chordSymbolOf, diatonicSevenths } from './sevenths';
import { placeChord, voiceLead, voiceMotion } from './voiceLeading';
import { PRACTICE_RANGE } from './voicing';

describe('diatonicSevenths', () => {
  it('C major: Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7', () => {
    const c = diatonicSevenths({ tonic: 'C', mode: 'major' });
    expect(c.map((s) => s.numeral)).toEqual([
      'Imaj7',
      'ii7',
      'iii7',
      'IVmaj7',
      'V7',
      'vi7',
      'viiø7',
    ]);
    expect(c.map((s) => s.short)).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bø7']);
    expect(c.map((s) => s.triadQuality)).toEqual([
      'major',
      'minor',
      'minor',
      'major',
      'major',
      'minor',
      'diminished',
    ]);
    expect(c[4]).toMatchObject({ name: 'G dominant 7th', root: 'G', seventh: 'F', quality: '7' });
    expect(c[6]?.name).toBe('B half-diminished 7th');
  });

  it('spells with the key: F♯ major and B♭ major', () => {
    const fs = diatonicSevenths({ tonic: 'F#', mode: 'major' });
    expect(fs[0]).toMatchObject({
      root: 'F#',
      third: 'A#',
      fifth: 'C#',
      seventh: 'E#',
      short: 'F♯maj7',
    });
    expect(fs[6]?.short).toBe('E♯ø7');
    const bb = diatonicSevenths({ tonic: 'Bb', mode: 'major' });
    expect(bb[4]).toMatchObject({ root: 'F', seventh: 'Eb', short: 'F7' });
  });

  it('minor keys stack the same way: i7 iiø7 IIImaj7 iv7 v7 VImaj7 VII7', () => {
    const a = diatonicSevenths({ tonic: 'A', mode: 'minor' });
    expect(a.map((s) => s.numeral)).toEqual([
      'i7',
      'iiø7',
      'IIImaj7',
      'iv7',
      'v7',
      'VImaj7',
      'VII7',
    ]);
  });
});

describe('chordSymbolOf', () => {
  it('names triads and 7ths from root-first pitch classes', () => {
    expect(chordSymbolOf(['A', 'C#', 'E'])).toBe('A');
    expect(chordSymbolOf(['G#', 'B', 'D'])).toBe('G♯°');
    expect(chordSymbolOf(['C', 'E', 'G', 'B'])).toBe('Cmaj7');
    expect(chordSymbolOf(['D', 'F', 'A', 'C'])).toBe('Dm7');
    expect(chordSymbolOf(['B', 'D', 'F', 'A'])).toBe('Bø7');
    expect(chordSymbolOf(['C', 'E', 'G#'])).toBeNull();
    expect(chordSymbolOf(['C', 'E'])).toBeNull();
  });
});

describe('7th chords on the keyboard', () => {
  it('hint placement keeps every diatonic 7th inside C3..B4; triads are unchanged', () => {
    for (const tonic of ['C', 'C#', 'Db', 'B', 'F#'] as const) {
      for (const s of diatonicSevenths({ tonic, mode: 'major' })) {
        const keys = placeChord({ pcs: s.pcs });
        expect(Math.min(...keys)).toBeGreaterThanOrEqual(PRACTICE_RANGE.low);
        expect(Math.max(...keys)).toBeLessThanOrEqual(PRACTICE_RANGE.high);
      }
    }
    expect(placeChord({ pcs: [1, 5, 8] })).toEqual([61, 65, 68]); // C♯ major from C♯4
    expect(placeChord({ pcs: [1, 5, 8, 0] })).toEqual([49, 53, 56, 60]); // C♯maj7 drops to C♯3
  });

  it('ii7–V7–Imaj7 voice-leads with every voice moving at most a whole step', () => {
    const [, ii, , , V] = diatonicSevenths({ tonic: 'C', mode: 'major' });
    const I = diatonicSevenths({ tonic: 'C', mode: 'major' })[0];
    if (!ii || !V || !I) throw new Error('missing chords');
    const path = voiceLead([{ pcs: ii.pcs }, { pcs: V.pcs }, { pcs: I.pcs }]);
    for (let i = 1; i < path.length; i++) {
      const moves = voiceMotion(path[i - 1] ?? [], path[i] ?? []) ?? [];
      expect(moves).toHaveLength(4);
      expect(Math.max(...moves.map(Math.abs))).toBeLessThanOrEqual(2);
    }
  });
});

// decisions.md 2026-10-18 "Minor progressions".
describe('harmonic minor', () => {
  it('raises the 7th: V is major; VII stays natural', async () => {
    const { harmonicTriads } = await import('./triads');
    const { harmonicMinorScale, spellableMinor } = await import('./keys');
    expect(harmonicMinorScale({ tonic: 'A', mode: 'minor' })).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G#',
    ]);
    const eb = harmonicTriads({ tonic: 'Eb', mode: 'minor' });
    expect(eb[4]).toMatchObject({
      numeral: 'V',
      root: 'Bb',
      third: 'D',
      fifth: 'F',
      quality: 'major',
    });
    expect(eb[6]).toMatchObject({ numeral: 'VII', root: 'Db', quality: 'major' });
    expect(() => harmonicMinorScale({ tonic: 'G#', mode: 'minor' })).toThrow(RangeError);
    expect(spellableMinor({ tonic: 'G#', mode: 'minor' })).toEqual({ tonic: 'Ab', mode: 'minor' });
    expect(spellableMinor({ tonic: 'C#', mode: 'minor' })).toEqual({ tonic: 'C#', mode: 'minor' });
  });
});

// decisions.md 2026-10-18 "12-bar blues".
describe('dominantSeventhOn', () => {
  it('spells I7, IV7 and V7 by letters; C♭7 cannot be spelled', async () => {
    const { dominantSeventhOn } = await import('./sevenths');
    expect(dominantSeventhOn('C')).toMatchObject({
      short: 'C7',
      third: 'E',
      seventh: 'Bb',
      numeral: 'I7',
    });
    expect(dominantSeventhOn('F', 4)).toMatchObject({ numeral: 'IV7', third: 'A', seventh: 'Eb' });
    expect(dominantSeventhOn('C#', 5)).toMatchObject({ third: 'E#', seventh: 'B', short: 'C♯7' });
    expect(() => dominantSeventhOn('Cb')).toThrow(RangeError);
    const I = dominantSeventhOn('C');
    const IV = dominantSeventhOn('F', 4);
    const path = voiceLead([{ pcs: I.pcs }, { pcs: IV.pcs }, { pcs: I.pcs }]);
    for (let i = 1; i < path.length; i++) {
      const moves = voiceMotion(path[i - 1] ?? [], path[i] ?? []) ?? [];
      expect(Math.max(...moves.map(Math.abs))).toBeLessThanOrEqual(2);
    }
  });
});
