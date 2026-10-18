// Jam takes (decisions.md 2026-10-18 "Jam"): what the learner played over a number of loops,
// kept as notes timed from the take's first beat, so playback can line them up with the
// backing again. Pure; times are synth-clock seconds.
import type { Midi } from '@cadence/music';

export interface TakeNote {
  midi: Midi;
  /** Seconds from the take's first beat. */
  start: number;
  dur: number;
  velocity: number;
}

export interface Take {
  id: number;
  presetId: string;
  tonic: string;
  bpm: number;
  loops: number;
  /** Seconds. */
  length: number;
  notes: TakeNote[];
}

export interface TakeInfo {
  presetId: string;
  tonic: string;
  bpm: number;
  loops: number;
}

/** A take being recorded from synth time `startAt` for `length` seconds. */
export class TakeRecorder {
  private readonly open = new Map<Midi, { start: number; velocity: number }>();
  private readonly notes: TakeNote[] = [];

  constructor(
    readonly startAt: number,
    readonly length: number,
    private readonly info: TakeInfo,
  ) {}

  get endAt(): number {
    return this.startAt + this.length;
  }

  /** A key event at synth time `at`; anything outside the take's window is ignored. */
  add(ev: { type: 'on' | 'off'; midi: Midi; velocity: number; at: number }): void {
    const t = ev.at - this.startAt;
    if (ev.type === 'on') {
      if (t < 0 || t >= this.length) return;
      this.close(ev.midi, t);
      this.open.set(ev.midi, { start: t, velocity: ev.velocity });
      return;
    }
    this.close(ev.midi, Math.min(Math.max(t, 0), this.length));
  }

  /** The finished take: notes still held are cut at the end. */
  finish(id: number): Take {
    for (const midi of [...this.open.keys()]) this.close(midi, this.length);
    return {
      id,
      ...this.info,
      length: this.length,
      notes: [...this.notes].sort((a, b) => a.start - b.start),
    };
  }

  private close(midi: Midi, t: number): void {
    const note = this.open.get(midi);
    if (!note) return;
    this.open.delete(midi);
    this.notes.push({
      midi,
      start: note.start,
      dur: Math.max(0.02, t - note.start),
      velocity: note.velocity,
    });
  }
}

/** Takes kept per visit: the newest first, at most `MAX_TAKES`. */
export const MAX_TAKES = 5;

export function keepTake(takes: readonly Take[], take: Take): Take[] {
  return [take, ...takes].slice(0, MAX_TAKES);
}
