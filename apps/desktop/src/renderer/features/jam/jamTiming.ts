// Jam timing (decisions.md 2026-10-18 "Jam"): where each beat of a looping chart falls and what
// the backing plays on it. Pure: the transport calls `eventsForBeat` once per beat as it
// schedules ahead, so a tempo change takes effect from the next beat.
import type { JamChart } from '@cadence/content';
import { type Midi, pcNumber, voiceLead } from '@cadence/music';

export const BEATS_PER_BAR = 4;
/** One bar of clicks before the loop starts. */
export const COUNT_IN_BEATS = 4;
export const MIN_BPM = 50;
export const MAX_BPM = 160;

/** Held: each chord rings for its bars. Pulse: the chord restrikes on every beat. */
export type CompStyle = 'held' | 'pulse';

export interface JamSettings {
  bpm: number;
  comp: CompStyle;
  click: boolean;
}

export type JamEvent =
  | { kind: 'notes'; notes: Midi[]; at: number; dur: number; velocity: number }
  | { kind: 'tick'; at: number; accent: boolean };

/** Backing levels: the bass a little stronger than the chords, beat 1 of a pulse leaning in. */
export const BASS_VELOCITY = 86;
export const HELD_VELOCITY = 62;
export const PULSE_VELOCITY = 58;
export const PULSE_ACCENT_VELOCITY = 70;
/** Notes let go just before the next one starts. */
const LEGATO = 0.95;
const PULSE_LENGTH = 0.6;

export const beatSec = (bpm: number): number => 60 / bpm;
export const loopBeats = (chart: Pick<JamChart, 'bars'>): number => chart.bars * BEATS_PER_BAR;

export interface BeatPosition {
  /** Index into `chart.chords`. */
  chord: number;
  beatInChord: number;
  /** Beats the chord lasts. */
  chordBeats: number;
  /** 0-based bar of the loop, and the beat in it. */
  bar: number;
  beatInBar: number;
  /** Which time round the loop (0 = first). */
  loop: number;
}

/** Where loop beat `beat` (0 and up; it wraps) falls in the chart. */
export function positionOf(chart: Pick<JamChart, 'chords' | 'bars'>, beat: number): BeatPosition {
  const total = loopBeats(chart);
  const loop = Math.floor(beat / total);
  const inLoop = ((beat % total) + total) % total;
  let start = 0;
  for (let chord = 0; chord < chart.chords.length; chord++) {
    const chordBeats = (chart.chords[chord]?.bars ?? 1) * BEATS_PER_BAR;
    if (inLoop < start + chordBeats) {
      return {
        chord,
        beatInChord: inLoop - start,
        chordBeats,
        bar: Math.floor(inLoop / BEATS_PER_BAR),
        beatInBar: inLoop % BEATS_PER_BAR,
        loop,
      };
    }
    start += chordBeats;
  }
  return { chord: 0, beatInChord: 0, chordBeats: BEATS_PER_BAR, bar: 0, beatInBar: 0, loop };
}

/**
 * The backing voicing of each chord: a left-hand root in C2..B2 under a right-hand chord, voice-
 * led around the loop (`voiceLead` with a free bass), so the comping moves smoothly.
 */
export function backingVoicings(chart: Pick<JamChart, 'chords'>): Midi[][] {
  return voiceLead(
    chart.chords.map((ch) => ({ pcs: ch.notes.map(pcNumber), bass: pcNumber(ch.bass) })),
    true,
  );
}

/**
 * What sounds on beat `beat` at synth time `at`: count-in clicks for negative beats; then the
 * click (if on), the bass on each chord's first beat, and the chord — held for its length, or
 * struck on every beat.
 */
export function eventsForBeat(
  chart: Pick<JamChart, 'chords' | 'bars'>,
  voicings: readonly (readonly Midi[])[],
  settings: JamSettings,
  beat: number,
  at: number,
): JamEvent[] {
  if (beat < 0) return [{ kind: 'tick', at, accent: beat === -COUNT_IN_BEATS }];
  const sec = beatSec(settings.bpm);
  const pos = positionOf(chart, beat);
  const out: JamEvent[] = [];
  if (settings.click) out.push({ kind: 'tick', at, accent: pos.beatInBar === 0 });
  const [bass, ...upper] = voicings[pos.chord] ?? [];
  const chordDur = (pos.chordBeats - pos.beatInChord) * sec * LEGATO;
  if (pos.beatInChord === 0 && bass !== undefined) {
    out.push({ kind: 'notes', notes: [bass], at, dur: chordDur, velocity: BASS_VELOCITY });
  }
  if (upper.length > 0) {
    if (settings.comp === 'held' && pos.beatInChord === 0) {
      out.push({ kind: 'notes', notes: upper, at, dur: chordDur, velocity: HELD_VELOCITY });
    } else if (settings.comp === 'pulse') {
      out.push({
        kind: 'notes',
        notes: upper,
        at,
        dur: sec * PULSE_LENGTH,
        velocity: pos.beatInBar === 0 ? PULSE_ACCENT_VELOCITY : PULSE_VELOCITY,
      });
    }
  }
  return out;
}
