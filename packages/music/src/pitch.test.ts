// engine.md §1 pitch.ts / §1.T
import { describe, expect, it } from 'vitest';
import {
  LETTERS,
  MIDI_HIGH_88,
  MIDI_LOW_88,
  MODE_OFFSETS,
  inRange88,
  isLetter,
  isNote,
  isPitchClass,
  midiOctave,
  midiToFrequency,
  midiToNote,
  midiToPc,
  noteToMidi,
  parseNote,
  parsePitchClass,
  pcName,
  pcNumber,
  pretty,
  spelledNote,
  spellOnLetters,
} from './pitch';

describe('pitch classes', () => {
  it('pcNumber maps letters and accidentals, wrapping Cb → 11 and B# → 0', () => {
    expect(pcNumber('C')).toBe(0);
    expect(pcNumber('F#')).toBe(6);
    expect(pcNumber('Bb')).toBe(10);
    expect(pcNumber('Cb')).toBe(11);
    expect(pcNumber('B#')).toBe(0);
    expect(pcNumber('E#')).toBe(5);
  });

  it('parsePitchClass / parseNote split and reject malformed input', () => {
    expect(parsePitchClass('Bb')).toEqual({ letter: 'B', accidental: 'b' });
    expect(parsePitchClass('E')).toEqual({ letter: 'E', accidental: '' });
    expect(parseNote('Cb4')).toEqual({ letter: 'C', accidental: 'b', octave: 4 });
    expect(parseNote('A-1')).toEqual({ letter: 'A', accidental: '', octave: -1 });
    expect(() => parsePitchClass('H')).toThrow(RangeError);
    expect(() => parsePitchClass('C##')).toThrow(RangeError);
    expect(() => parseNote('C#')).toThrow(RangeError);
    expect(() => parseNote('c4')).toThrow(RangeError);
  });

  it('type guards', () => {
    expect(isLetter('G')).toBe(true);
    expect(isLetter('g')).toBe(false);
    expect(isPitchClass('Ab')).toBe(true);
    expect(isPitchClass('Ab3')).toBe(false);
    expect(isNote('Ab3')).toBe(true);
    expect(isNote('Ab')).toBe(false);
    expect(LETTERS).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(MODE_OFFSETS.major).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(MODE_OFFSETS.minor).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });
});

describe('MIDI', () => {
  it('noteToMidi: middle C is 60, Cb4 is 59, A0 is 21, C8 is 108', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('Cb4')).toBe(59);
    expect(noteToMidi('B#3')).toBe(60);
    expect(noteToMidi('A0')).toBe(21);
    expect(noteToMidi('C8')).toBe(108);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('F#3')).toBe(54);
  });

  it('midiToPc and midiOctave', () => {
    expect(midiToPc(60)).toBe(0);
    expect(midiToPc(61)).toBe(1);
    expect(midiToPc(59)).toBe(11);
    expect(midiToPc(-1)).toBe(11);
    expect(midiOctave(60)).toBe(4);
    expect(midiOctave(59)).toBe(3);
    expect(midiOctave(21)).toBe(0);
    expect(midiOctave(108)).toBe(8);
  });

  it('midiToNote round-trips and follows the spelling', () => {
    expect(midiToNote(60)).toBe('C4');
    expect(midiToNote(61)).toBe('C#4');
    expect(midiToNote(61, 'flats')).toBe('Db4');
    expect(midiToNote(63)).toBe('Eb4');
    expect(midiToNote(63, 'sharps')).toBe('D#4');
    expect(midiToNote(59, { key: { tonic: 'Gb', mode: 'major' } })).toBe('Cb4');
    for (let m = MIDI_LOW_88; m <= MIDI_HIGH_88; m++) {
      expect(noteToMidi(midiToNote(m))).toBe(m);
      expect(noteToMidi(midiToNote(m, 'sharps'))).toBe(m);
      expect(noteToMidi(midiToNote(m, 'flats'))).toBe(m);
    }
  });

  it('spelledNote puts the octave on the letter and rejects a mismatched spelling', () => {
    expect(spelledNote(59, 'Cb')).toBe('Cb4');
    expect(spelledNote(59, 'B')).toBe('B3');
    expect(spelledNote(60, 'B#')).toBe('B#3');
    expect(() => spelledNote(60, 'D')).toThrow(RangeError);
  });

  it('midiToFrequency: A4 = 440 Hz, C4 ≈ 261.63 Hz', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 2);
    expect(midiToFrequency(81)).toBe(880);
  });

  it('inRange88 covers MIDI 21..108 only', () => {
    expect(inRange88(21)).toBe(true);
    expect(inRange88(108)).toBe(true);
    expect(inRange88(20)).toBe(false);
    expect(inRange88(109)).toBe(false);
    expect(inRange88(60.5)).toBe(false);
  });
});

describe('spelling', () => {
  it('pcName default = ear-screen keyboard labels', () => {
    const labels = Array.from({ length: 12 }, (_, pc) => pcName(pc));
    expect(labels).toEqual(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
  });

  it('pcName sharps / flats', () => {
    expect(pcName(1, 'sharps')).toBe('C#');
    expect(pcName(1, 'flats')).toBe('Db');
    expect(pcName(8, 'sharps')).toBe('G#');
    expect(pcName(8, 'flats')).toBe('Ab');
    expect(pcName(12)).toBe('C');
  });

  it('pcName by key spells diatonic notes from the scale and the rest from the key family', () => {
    const gb = { key: { tonic: 'Gb', mode: 'major' } } as const;
    expect(pcName(11, gb)).toBe('Cb');
    expect(pcName(6, gb)).toBe('Gb');
    expect(pcName(2, gb)).toBe('D'); // non-diatonic → flats family (D is natural anyway)
    expect(pcName(9, gb)).toBe('A');
    const b = { key: { tonic: 'B', mode: 'major' } } as const;
    expect(pcName(10, b)).toBe('A#');
    expect(pcName(5, b)).toBe('F'); // non-diatonic → sharps family: F (natural) rather than E#
    expect(pcName(3, b)).toBe('D#');
    const c = { key: { tonic: 'C', mode: 'major' } } as const;
    expect(pcName(1, c)).toBe('C#');
    expect(pcName(3, c)).toBe('Eb');
  });

  it('pretty renders ♯ and ♭ without touching letters', () => {
    expect(pretty('C#4')).toBe('C♯4');
    expect(pretty('Bb3')).toBe('B♭3');
    expect(pretty('Bbm')).toBe('B♭m');
    expect(pretty('B minor')).toBe('B minor');
    expect(pretty('G#°')).toBe('G♯°');
    expect(pretty('Cb')).toBe('C♭');
  });

  it('spellOnLetters cycles letters from the tonic and computes accidentals', () => {
    expect(spellOnLetters('A', MODE_OFFSETS.major)).toEqual(['A', 'B', 'C#', 'D', 'E', 'F#', 'G#']);
    expect(spellOnLetters('Eb', MODE_OFFSETS.minor)).toEqual([
      'Eb',
      'F',
      'Gb',
      'Ab',
      'Bb',
      'Cb',
      'Db',
    ]);
    expect(spellOnLetters('C', [0, 2, 4])).toEqual(['C', 'D', 'E']);
    expect(spellOnLetters('F', [0, 2, 3])).toEqual(['F', 'G', 'Ab']);
    expect(() => spellOnLetters('G#', MODE_OFFSETS.major)).toThrow(/double accidental/);
  });
});
