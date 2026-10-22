// Imported songs on the screen (decisions.md 2026-10-21 "Songs from MIDI"): time from the
// tempo map, the steps Wait mode asks for (each moment keys go down together, per hand), notes
// as they should sound (held by the pedal), the keyboard range, and a best-guess chord name.
import { type Midi, midiToPc, pcName } from '@cadence/music';
import type { ChannelOutput } from '@shared/ipc/contracts';

export type Song = ChannelOutput<'songs.get'>;
export type SongNote = Song['left'][number];
export type Hand = 'left' | 'right';
export type HandChoice = Hand | 'both';

/** Notes starting this close together (in beats) are one step: a chord rolled by the MIDI. */
export const SAME_MOMENT = 0.04;

// ---------------------------------------------------------------- time

/** Seconds from the start to `beat`, through every tempo change. */
export function secAt(song: Pick<Song, 'tempos'>, beat: number): number {
  let sec = 0;
  const tempos = song.tempos.length > 0 ? song.tempos : [{ beat: 0, bpm: 120 }];
  for (let i = 0; i < tempos.length; i++) {
    const t = tempos[i];
    if (!t) continue;
    const next = tempos[i + 1]?.beat ?? Infinity;
    if (beat <= t.beat) break;
    sec += ((Math.min(beat, next) - t.beat) * 60) / t.bpm;
    if (beat <= next) break;
  }
  return sec;
}

/** The beat at `sec` seconds from the start (the inverse of `secAt`). */
export function beatAtSec(song: Pick<Song, 'tempos'>, sec: number): number {
  const tempos = song.tempos.length > 0 ? song.tempos : [{ beat: 0, bpm: 120 }];
  let elapsed = 0;
  for (let i = 0; i < tempos.length; i++) {
    const t = tempos[i];
    if (!t) continue;
    const next = tempos[i + 1]?.beat ?? Infinity;
    const span = ((next - t.beat) * 60) / t.bpm;
    if (sec <= elapsed + span) return t.beat + ((sec - elapsed) * t.bpm) / 60;
    elapsed += span;
  }
  return 0;
}

/** The bar holding `beat`, and the beat inside it (0-based). */
export function barAt(
  song: Pick<Song, 'bars'>,
  beat: number,
): { number: number; beatInBar: number } {
  let found = song.bars[0];
  for (const bar of song.bars) {
    if (bar.beat <= beat + 1e-6) found = bar;
    else break;
  }
  return { number: found?.number ?? 1, beatInBar: found ? beat - found.beat : beat };
}

/** Where a range of bars starts and ends, in beats. */
export function barRange(song: Pick<Song, 'bars' | 'lengthBeats'>, from: number, to: number) {
  const first = song.bars.find((b) => b.number === from) ?? song.bars[0];
  const last = song.bars.find((b) => b.number === to) ?? song.bars.at(-1);
  return {
    start: first?.beat ?? 0,
    end: last
      ? Math.min(last.beat + last.beats, Math.max(song.lengthBeats, last.beat + last.beats))
      : song.lengthBeats,
  };
}

// ---------------------------------------------------------------- hands and steps

export const handsOf = (choice: HandChoice): Hand[] =>
  choice === 'both' ? ['left', 'right'] : [choice];

export interface StepNote {
  midi: Midi;
  hand: Hand;
}

export interface SongStep {
  beat: number;
  notes: StepNote[];
}

/** Every moment the chosen hands put keys down, within [start, end) beats, in order. */
export function songSteps(song: Song, choice: HandChoice, start: number, end: number): SongStep[] {
  const notes = handsOf(choice)
    .flatMap((hand) => song[hand].map((n) => ({ ...n, hand })))
    .filter((n) => n.beat >= start - 1e-6 && n.beat < end - 1e-6)
    .sort((a, b) => a.beat - b.beat || a.midi - b.midi);
  const steps: SongStep[] = [];
  for (const n of notes) {
    const last = steps.at(-1);
    if (last && n.beat - last.beat < SAME_MOMENT) {
      if (!last.notes.some((x) => x.midi === n.midi))
        last.notes.push({ midi: n.midi, hand: n.hand });
    } else {
      steps.push({ beat: n.beat, notes: [{ midi: n.midi, hand: n.hand }] });
    }
  }
  return steps;
}

/**
 * Notes as the piano sounds them: a key released while the sustain pedal is down rings on
 * until the pedal comes up.
 */
export function withPedal(notes: readonly SongNote[], pedal: Song['pedal']): SongNote[] {
  if (pedal.length === 0) return [...notes];
  return notes.map((n) => {
    const release = n.beat + n.dur;
    if (!pedalDownAt(pedal, release)) return n;
    const up = pedal.find((p) => p.beat > release && !p.down);
    return up ? { ...n, dur: up.beat - n.beat } : n;
  });
}

/** Whether the sustain pedal is down at `beat`. */
export function pedalDownAt(pedal: Song['pedal'], beat: number): boolean {
  let down = false;
  for (const p of pedal) {
    if (p.beat > beat + 1e-6) break;
    down = p.down;
  }
  return down;
}

// ---------------------------------------------------------------- keyboard and names

/** The C below the lowest note and enough octaves to reach the highest. */
export function keyboardRange(song: Pick<Song, 'left' | 'right'>): {
  startMidi: Midi;
  octaves: number;
} {
  const all = [...song.left, ...song.right].map((n) => n.midi);
  if (all.length === 0) return { startMidi: 48, octaves: 2 };
  const low = Math.min(...all);
  const high = Math.max(...all);
  const startMidi = low - midiToPc(low);
  return { startMidi, octaves: Math.max(2, Math.floor((high - startMidi) / 12) + 1) };
}

const CHORDS: readonly (readonly [suffix: string, intervals: readonly number[]])[] = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['°', [0, 3, 6]],
  ['sus2', [0, 2, 7]],
  ['sus4', [0, 5, 7]],
  ['maj7', [0, 4, 7, 11]],
  ['7', [0, 4, 7, 10]],
  ['m7', [0, 3, 7, 10]],
  ['ø7', [0, 3, 6, 10]],
  ['6', [0, 4, 7, 9]],
  ['m6', [0, 3, 7, 9]],
  ['add9', [0, 2, 4, 7]],
  ['madd9', [0, 2, 3, 7]],
  ['maj9', [0, 2, 4, 7, 11]],
  ['m9', [0, 2, 3, 7, 10]],
  ['9', [0, 2, 4, 7, 10]],
  ['5', [0, 7]],
];

/**
 * A best-guess chord symbol for keys held together ("Cm/E♭", "Dm7", "F/G"), or null. The
 * lowest key is the bass; a chord whose root isn't the bass reads as a slash chord. Only a
 * guide: the keys themselves are the truth.
 */
export function chordName(midis: readonly Midi[], flats = true): string | null {
  if (midis.length < 2) return null;
  const pcs = [...new Set(midis.map(midiToPc))];
  const bass = midiToPc(Math.min(...midis));
  const spelling = flats ? 'flats' : 'sharps';
  const name = (pc: number) => pcName(pc, spelling).replace('b', '♭').replace('#', '♯');
  const match = (notes: readonly number[], root: number) =>
    CHORDS.find(([, intervals]) => {
      const set = new Set(intervals.map((i) => (root + i) % 12));
      return set.size === notes.length && notes.every((p) => set.has(p));
    });
  // 1. The bass is the root: "E♭", "Dm7".
  const own = match(pcs, bass);
  if (own) return `${name(bass)}${own[0]}`;
  // 2. A chord of three or more notes over a bass note that isn't in it: "F/G", "Dm7/G".
  const upper = pcs.filter((p) => p !== bass);
  if (upper.length >= 3) {
    for (const root of upper) {
      const above = match(upper, root);
      if (above) return `${name(root)}${above[0]}/${name(bass)}`;
    }
  }
  // 3. An inversion: the bass is another chord tone ("Cm/E♭").
  for (const root of upper) {
    const inv = match(pcs, root);
    if (inv) return `${name(root)}${inv[0]}/${name(bass)}`;
  }
  return null;
}
