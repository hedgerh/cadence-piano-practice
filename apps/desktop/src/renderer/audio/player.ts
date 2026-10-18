// docs/engine.md §7 — maps a content Sound to synth calls.
//   t0 = currentTime + 0.05
//   notes:   one note every gapMs, 0.7 s each (the last rings 0.9 s)  — EarInterval:199–200
//   chord:   all notes together, 1.2 s
//   cadence: cadenceVoicing(key) — four chords 0.65 s apart (~3 s)
//   phrase:  eight notes 0.5 s apart, 0.5 s each (~4 s)
//   chords:  one chord every gapMs, each ringing until just before the next (the last 1.2 s)
import type { Sound } from '@cadence/content';
import { cadenceVoicing, noteToMidi, type Midi } from '@cadence/music';
import type { Synth } from './Synth';

export const LEAD_IN = 0.05;
export const NOTE_DUR = 0.7;
export const LAST_NOTE_DUR = 0.9;
export const CHORD_DUR = 1.2;
export const CADENCE_SPACING = 0.65;
/** Each cadence chord lets go just before the next; the final I rings like a chord. */
export const CADENCE_CHORD_DUR = 0.6;
export const PHRASE_STEP = 0.5;
/** A chord of a `chords` sound lets go this long before the next one starts. */
export const CHORDS_RELEASE = 0.05;

export interface ScheduledGroup {
  /** Notes struck together. */
  notes: Midi[];
  /** Offset from t0, seconds. */
  at: number;
  dur: number;
}

export function scheduleSound(sound: Sound): ScheduledGroup[] {
  switch (sound.type) {
    case 'notes': {
      const gap = sound.gapMs / 1000;
      return sound.notes.map((n, i) => ({
        notes: [noteToMidi(n)],
        at: i * gap,
        dur: i === sound.notes.length - 1 ? LAST_NOTE_DUR : NOTE_DUR,
      }));
    }
    case 'chord':
      return [{ notes: sound.notes.map(noteToMidi), at: 0, dur: CHORD_DUR }];
    case 'cadence': {
      const chords = cadenceVoicing({ tonic: sound.key, mode: sound.mode });
      return chords.map((notes, i) => ({
        notes,
        at: i * CADENCE_SPACING,
        dur: i === chords.length - 1 ? CHORD_DUR : CADENCE_CHORD_DUR,
      }));
    }
    case 'phrase':
      return sound.notes.map((n, i) => ({
        notes: [noteToMidi(n)],
        at: i * PHRASE_STEP,
        dur: PHRASE_STEP,
      }));
    case 'chords': {
      // decisions.md 2026-10-18 "Name the progression".
      const gap = sound.gapMs / 1000;
      return sound.chords.map((chord, i) => ({
        notes: chord.map(noteToMidi),
        at: i * gap,
        dur: i === sound.chords.length - 1 ? CHORD_DUR : Math.max(0.1, gap - CHORDS_RELEASE),
      }));
    }
  }
}

/** Seconds from t0 until the last note ends. */
export function soundDuration(sound: Sound): number {
  return scheduleSound(sound).reduce((end, g) => Math.max(end, g.at + g.dur), 0);
}

/**
 * Schedule `sound` on `synth` starting at `now() + LEAD_IN`.
 * Returns the seconds until it has finished sounding (lead-in included).
 */
export function playSound(synth: Pick<Synth, 'now' | 'playMidi'>, sound: Sound): number {
  const t0 = synth.now() + LEAD_IN;
  const groups = scheduleSound(sound);
  for (const g of groups) synth.playMidi(g.notes, t0 + g.at, g.dur);
  return LEAD_IN + groups.reduce((end, g) => Math.max(end, g.at + g.dur), 0);
}
