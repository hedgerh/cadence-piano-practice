// A song from a MIDI file (decisions.md 2026-10-21 "Songs from MIDI"): every note in beats
// (quarter notes), split into the two hands, with the tempo, meter, bar lines and the sustain
// pedal. Hands come from the file's tracks, never from a split point: a left hand that climbs
// above middle C is still the left hand.
import type { MidiFile, MidiNote } from './midiFile';
import type { Midi } from './pitch';

export interface SongNote {
  /** Start, in beats (quarter notes) from the beginning. */
  beat: number;
  dur: number;
  midi: Midi;
  velocity: number;
}

export interface SongBar {
  /** 1-based, as players count. */
  number: number;
  beat: number;
  /** Beats (quarter notes) in the bar: 4 in 4/4, 2 in 2/4, 3 in 6/8. */
  beats: number;
  num: number;
  den: number;
}

export interface SongData {
  title: string;
  tempos: { beat: number; bpm: number }[];
  bars: SongBar[];
  left: SongNote[];
  right: SongNote[];
  pedal: { beat: number; down: boolean }[];
  /** Where the last note ends, in beats. */
  lengthBeats: number;
}

/** Where hands split when a file has only one part: middle C and up is the right hand. */
export const ONE_PART_SPLIT: Midi = 60;
/** Files larger than this many notes are refused (a piano part is a few thousand). */
export const MAX_SONG_NOTES = 40_000;

const round = (x: number) => Math.round(x * 10_000) / 10_000;

/**
 * Two hands from a file's parts: with two or more, the part highest on average is the right
 * hand and the lowest the left; any others join whichever is nearer middle C. One part splits
 * at middle C.
 */
export function songFromMidi(file: MidiFile, title: string): SongData {
  const parts = file.tracks.filter((t) => t.notes.length > 0);
  const total = parts.reduce((n, t) => n + t.notes.length, 0);
  if (total === 0) throw new RangeError('the file has no notes');
  if (total > MAX_SONG_NOTES)
    throw new RangeError(`the file has more than ${MAX_SONG_NOTES} notes`);
  const toBeat = (tick: number) => round(tick / file.ppq);
  const note = (n: MidiNote): SongNote => ({
    beat: toBeat(n.tick),
    dur: round(n.dur / file.ppq),
    midi: n.midi,
    velocity: n.velocity,
  });

  let left: MidiNote[] = [];
  let right: MidiNote[] = [];
  if (parts.length === 1) {
    const only = parts[0]?.notes ?? [];
    left = only.filter((n) => n.midi < ONE_PART_SPLIT);
    right = only.filter((n) => n.midi >= ONE_PART_SPLIT);
  } else {
    const avg = (notes: readonly MidiNote[]) =>
      notes.reduce((s, n) => s + n.midi, 0) / notes.length;
    const ranked = [...parts].sort((a, b) => avg(b.notes) - avg(a.notes));
    ranked.forEach((part, i) => {
      if (i === 0) right.push(...part.notes);
      else if (i === ranked.length - 1) left.push(...part.notes);
      else if (avg(part.notes) >= ONE_PART_SPLIT) right.push(...part.notes);
      else left.push(...part.notes);
    });
  }
  const byBeat = (a: SongNote, b: SongNote) => a.beat - b.beat || a.midi - b.midi;
  const leftNotes = left.map(note).sort(byBeat);
  const rightNotes = right.map(note).sort(byBeat);
  const lengthBeats = Math.max(...[...leftNotes, ...rightNotes].map((n) => n.beat + n.dur));

  const pedal = file.tracks
    .flatMap((t) => t.pedal)
    .sort((a, b) => a.tick - b.tick)
    .reduce<{ beat: number; down: boolean }[]>((out, p) => {
      if (out.at(-1)?.down !== p.down) out.push({ beat: toBeat(p.tick), down: p.down });
      return out;
    }, []);

  const tempos = (file.tempos.length > 0 ? file.tempos : [{ tick: 0, bpm: 120 }]).map((t) => ({
    beat: toBeat(t.tick),
    bpm: round(t.bpm),
  }));
  if ((tempos[0]?.beat ?? 0) > 0) tempos.unshift({ beat: 0, bpm: tempos[0]?.bpm ?? 120 });

  return {
    title,
    tempos: dedupe(tempos, (a, b) => a.bpm === b.bpm),
    bars: barLines(file, lengthBeats),
    left: leftNotes,
    right: rightNotes,
    pedal,
    lengthBeats: round(lengthBeats),
  };
}

/** Bar lines from the meter changes, covering the whole song. */
export function barLines(file: Pick<MidiFile, 'meters' | 'ppq'>, lengthBeats: number): SongBar[] {
  const meters = (file.meters.length > 0 ? file.meters : [{ tick: 0, num: 4, den: 4 }]).map(
    (m) => ({
      beat: m.tick / file.ppq,
      num: m.num,
      den: m.den,
    }),
  );
  const bars: SongBar[] = [];
  let beat = 0;
  let meter = meters[0] ?? { beat: 0, num: 4, den: 4 };
  let next = 1;
  while (beat < lengthBeats - 1e-6 || bars.length === 0) {
    while (next < meters.length && (meters[next]?.beat ?? Infinity) <= beat + 1e-6) {
      meter = meters[next] ?? meter;
      next += 1;
    }
    const beats = (meter.num * 4) / meter.den;
    bars.push({
      number: bars.length + 1,
      beat: round(beat),
      beats,
      num: meter.num,
      den: meter.den,
    });
    beat += beats;
  }
  return bars;
}

function dedupe<T>(xs: T[], same: (a: T, b: T) => boolean): T[] {
  return xs.filter((x, i) => i === 0 || !same(xs[i - 1] as T, x));
}
