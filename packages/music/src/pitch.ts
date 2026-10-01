// engine.md §1 pitch.ts — pitch names, MIDI math and spelling.
// Notes are ASCII in data ("C#4", "Bb3"); `pretty()` renders ♯/♭ for display.
// Middle C = C4 = MIDI 60. 88 keys = MIDI 21..108.
import type { Key } from './keys';

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = '' | '#' | 'b';
/** A spelled pitch class without octave, e.g. "F#", "Bb", "E". */
export type PitchClass = `${Letter}${Accidental}`;
/** A spelled note with octave, e.g. "F#4", "Cb4". */
export type Note = `${PitchClass}${number}`;
/** MIDI note number (60 = C4). */
export type Midi = number;
/** Integer pitch class 0..11 (0 = C). */
export type Pc = number;
/**
 * How to spell a pitch class: `'default'` is the ear-screen keyboard labelling
 * (C C# D Eb E F F# G Ab A Bb B); `{ key }` spells diatonic notes as in the key's
 * scale and falls back to the key's accidental family for the rest.
 */
export type Spelling = 'sharps' | 'flats' | 'default' | { key: Key };

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC: Readonly<Record<Letter, Pc>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL_OFFSET: Readonly<Record<Accidental, number>> = { '': 0, '#': 1, b: -1 };

const SHARP_NAMES: readonly PitchClass[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];
const FLAT_NAMES: readonly PitchClass[] = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];
const DEFAULT_NAMES: readonly PitchClass[] = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];

/** Semitone offsets of the natural major / natural minor scale from the tonic. */
export const MODE_OFFSETS: Readonly<Record<'major' | 'minor', readonly number[]>> = {
  major: [0, 2, 4, 5, 7, 9, 11], // steps 2 2 1 2 2 2 1
  minor: [0, 2, 3, 5, 7, 8, 10], // steps 2 1 2 2 1 2 2
};

export const MIDI_LOW_88: Midi = 21;
export const MIDI_HIGH_88: Midi = 108;

const PC_RE = /^([A-G])(#|b)?$/;
const NOTE_RE = /^([A-G])(#|b)?(-?\d+)$/;

function nth<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new RangeError(`index ${i} out of range`);
  return v;
}

export function isLetter(s: string): s is Letter {
  return (LETTERS as readonly string[]).includes(s);
}

export function isPitchClass(s: string): s is PitchClass {
  return PC_RE.test(s);
}

export function isNote(s: string): s is Note {
  return NOTE_RE.test(s);
}

/** Split "Bb" into its letter and accidental. Throws on malformed input. */
export function parsePitchClass(pc: string): { letter: Letter; accidental: Accidental } {
  const m = PC_RE.exec(pc);
  if (!m) throw new RangeError(`invalid pitch class "${pc}"`);
  const letter = m[1] as Letter;
  const accidental = (m[2] ?? '') as Accidental;
  return { letter, accidental };
}

/** Split "Cb4" into letter, accidental and octave. Throws on malformed input. */
export function parseNote(note: string): {
  letter: Letter;
  accidental: Accidental;
  octave: number;
} {
  const m = NOTE_RE.exec(note);
  if (!m) throw new RangeError(`invalid note "${note}"`);
  const letter = m[1] as Letter;
  const accidental = (m[2] ?? '') as Accidental;
  const octave = Number(m[3]);
  return { letter, accidental, octave };
}

/** Integer pitch class of a spelled pitch class: pcNumber("Cb") === 11. */
export function pcNumber(pc: PitchClass): Pc {
  const { letter, accidental } = parsePitchClass(pc);
  return (((LETTER_PC[letter] + ACCIDENTAL_OFFSET[accidental]) % 12) + 12) % 12;
}

/** noteToMidi("C4") === 60; noteToMidi("Cb4") === 59 (the letter decides the octave). */
export function noteToMidi(note: Note): Midi {
  const { letter, accidental, octave } = parseNote(note);
  return (octave + 1) * 12 + LETTER_PC[letter] + ACCIDENTAL_OFFSET[accidental];
}

export function midiToPc(m: Midi): Pc {
  return ((m % 12) + 12) % 12;
}

/** Scientific octave of a MIDI number: midiOctave(60) === 4. */
export function midiOctave(m: Midi): number {
  return Math.floor(m / 12) - 1;
}

/**
 * Spell an integer pitch class. `'default'` gives the keyboard labels
 * C C# D Eb E F F# G Ab A Bb B; `{ key }` uses the key's scale spelling.
 */
export function pcName(pc: Pc, spelling: Spelling = 'default'): PitchClass {
  const p = midiToPc(pc);
  if (spelling === 'sharps') return nth(SHARP_NAMES, p);
  if (spelling === 'flats') return nth(FLAT_NAMES, p);
  if (spelling === 'default') return nth(DEFAULT_NAMES, p);
  const names = spellOnLetters(spelling.key.tonic, MODE_OFFSETS[spelling.key.mode]);
  const diatonic = names.find((n) => pcNumber(n) === p);
  if (diatonic) return diatonic;
  // Non-diatonic: follow the key's accidental family (C major / A minor → default).
  if (names.some((n) => n.endsWith('b'))) return nth(FLAT_NAMES, p);
  if (names.some((n) => n.endsWith('#'))) return nth(SHARP_NAMES, p);
  return nth(DEFAULT_NAMES, p);
}

/**
 * Build a Note from a MIDI number and a chosen spelling of its pitch class.
 * The octave follows the letter, so spelledNote(59, "Cb") === "Cb4".
 */
export function spelledNote(m: Midi, name: PitchClass): Note {
  const { accidental } = parsePitchClass(name);
  if (pcNumber(name) !== midiToPc(m)) {
    throw new RangeError(`"${name}" does not spell MIDI ${m}`);
  }
  const natural = m - ACCIDENTAL_OFFSET[accidental];
  return `${name}${midiOctave(natural)}`;
}

/** midiToNote(61) === "C#4"; midiToNote(61, 'flats') === "Db4". */
export function midiToNote(m: Midi, spelling: Spelling = 'default'): Note {
  return spelledNote(m, pcName(midiToPc(m), spelling));
}

/** Equal temperament, A4 = 440 Hz: 440 · 2^((m − 69) / 12). */
export function midiToFrequency(m: Midi): number {
  return 440 * 2 ** ((m - 69) / 12);
}

/** Render ASCII accidentals for display: "C#4" → "C♯4", "Bbm" → "B♭m". */
export function pretty(s: string): string {
  return s.replace(/#/g, '♯').replace(/([A-G])b/g, '$1♭');
}

/** True for the 88 piano keys, MIDI 21 (A0) .. 108 (C8). */
export function inRange88(m: Midi): boolean {
  return Number.isInteger(m) && m >= MIDI_LOW_88 && m <= MIDI_HIGH_88;
}

/**
 * Spell pitch classes on consecutive letters starting from the tonic's letter:
 * element i uses letter (tonicLetter + i) with the accidental
 * ((target − natural + 6) mod 12) − 6. Throws if a double accidental would be needed.
 */
export function spellOnLetters(tonic: PitchClass, offsets: readonly number[]): PitchClass[] {
  const { letter } = parsePitchClass(tonic);
  const tonicPc = pcNumber(tonic);
  const start = LETTERS.indexOf(letter);
  return offsets.map((offset, i): PitchClass => {
    const l = nth(LETTERS, (start + i) % 7);
    const target = midiToPc(tonicPc + offset);
    const acc = ((((target - LETTER_PC[l] + 6) % 12) + 12) % 12) - 6;
    if (acc === 0) return l;
    if (acc === 1) return `${l}#`;
    if (acc === -1) return `${l}b`;
    throw new RangeError(`${tonic}: degree ${i + 1} needs a double accidental on ${l}`);
  });
}
