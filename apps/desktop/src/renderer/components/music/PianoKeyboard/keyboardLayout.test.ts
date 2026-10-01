import { describe, expect, it } from 'vitest';
import { blackKeys, keyboardWidth, whiteKeys } from './keyboardLayout';

describe('keyboardLayout (docs/ui.md §2 PianoKeyboard)', () => {
  it('two-octave black-key lefts equal Practice:149–151', () => {
    const lefts = blackKeys('two-octave').map((k) => k.leftPx);
    expect(lefts).toEqual([34.5, 81.5, 175.5, 222.5, 269.5, 363.5, 410.5, 504.5, 551.5, 598.5]);
  });

  it('every left follows 47·(i+1) − 12.5', () => {
    for (const k of blackKeys('two-octave')) {
      expect(k.leftPx).toBe(47 * (k.afterWhite + 1) - 12.5);
    }
  });

  it('one-octave black-key lefts equal EarInterval:167', () => {
    expect(blackKeys('one-octave').map((k) => k.leftPx)).toEqual([34.5, 81.5, 175.5, 222.5, 269.5]);
  });

  it('two-octave whites are C3..B4 with letter labels (Practice:148)', () => {
    const whites = whiteKeys('two-octave');
    expect(whites).toHaveLength(14);
    expect(whites.map((w) => w.label).join('')).toBe('CDEFGABCDEFGAB');
    expect(whites[0]?.midi).toBe(48);
    expect(whites[13]?.midi).toBe(71);
  });

  it('black keys are the sharps C#3..A#4', () => {
    expect(blackKeys('two-octave').map((k) => k.midi)).toEqual([
      49, 51, 54, 56, 58, 61, 63, 66, 68, 70,
    ]);
  });

  it('widths are 661 / 332 (Practice:90, EarInterval:81)', () => {
    expect(keyboardWidth('two-octave')).toBe(661);
    expect(keyboardWidth('one-octave')).toBe(332);
  });

  it('one-octave can start at another C', () => {
    expect(whiteKeys('one-octave', 48)[0]?.midi).toBe(48);
    expect(blackKeys('one-octave', 48)[0]?.midi).toBe(49);
  });
});
