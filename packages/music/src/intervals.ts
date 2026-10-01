// engine.md §1 intervals.ts — the 13 simple intervals used by ear training.
import { type Midi, type Note, type Spelling, midiToNote, noteToMidi } from './pitch';

export type IntervalId =
  'P1' | 'm2' | 'M2' | 'm3' | 'M3' | 'P4' | 'TT' | 'P5' | 'm6' | 'M6' | 'm7' | 'M7' | 'P8';

export interface Interval {
  id: IntervalId;
  name: string;
  semitones: number;
}

export const INTERVALS: readonly Interval[] = [
  { id: 'P1', name: 'Unison', semitones: 0 },
  { id: 'm2', name: 'Minor 2nd', semitones: 1 },
  { id: 'M2', name: 'Major 2nd', semitones: 2 },
  { id: 'm3', name: 'Minor 3rd', semitones: 3 },
  { id: 'M3', name: 'Major 3rd', semitones: 4 },
  { id: 'P4', name: 'Perfect 4th', semitones: 5 },
  { id: 'TT', name: 'Tritone', semitones: 6 },
  { id: 'P5', name: 'Perfect 5th', semitones: 7 },
  { id: 'm6', name: 'Minor 6th', semitones: 8 },
  { id: 'M6', name: 'Major 6th', semitones: 9 },
  { id: 'm7', name: 'Minor 7th', semitones: 10 },
  { id: 'M7', name: 'Major 7th', semitones: 11 },
  { id: 'P8', name: 'Octave', semitones: 12 },
];

export function intervalById(id: IntervalId): Interval {
  const found = INTERVALS.find((i) => i.id === id);
  if (!found) throw new RangeError(`unknown interval "${id}"`);
  return found;
}

/**
 * The simple interval between two MIDI notes (direction ignored). Compound
 * intervals fold to their simple form; whole octaves beyond one fold to P8.
 */
export function intervalBetween(a: Midi, b: Midi): Interval {
  const d = Math.abs(b - a);
  const simple = d === 0 ? 0 : ((d - 1) % 12) + 1;
  const found = INTERVALS.find((i) => i.semitones === simple);
  if (!found) throw new RangeError(`no interval for ${d} semitones`);
  return found;
}

/** transpose("C4", 7) === "G4"; transpose("C4", -1) === "B3"; spelled per `spelling`. */
export function transpose(note: Note, semitones: number, spelling: Spelling = 'default'): Note {
  return midiToNote(noteToMidi(note) + semitones, spelling);
}
