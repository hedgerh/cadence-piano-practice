// Play-along (decisions.md 2026-10-21 "Songs from MIDI"): the song's notes scheduled ahead on
// the synth clock, like Jam's transport — at a chosen speed, from one bar to another, looping if
// asked, with an optional click and a bar of count-in. The hand the learner plays is left out
// of `notes` by the caller.
import type { Synth } from '../../audio/Synth';
import { barAt, beatAtSec, secAt, type Song, type SongNote } from './songModel';

export const LOOKAHEAD = 0.2;
export const START_DELAY = 0.1;
export const MIN_SPEED = 0.25;

export type PlayerSynth = Pick<Synth, 'now' | 'playMidi' | 'tick' | 'stop'>;

export interface PlayOptions {
  /** The notes to play (already held by the pedal), sorted by beat. */
  notes: readonly SongNote[];
  startBeat: number;
  endBeat: number;
  /** 0.25..1 of the song's tempo. */
  speed: number;
  loop: boolean;
  click: boolean;
  countIn: boolean;
  /** Synth time to start at (defaults to now + START_DELAY). */
  at?: number;
}

export class SongPlayer {
  private opts: PlayOptions | null = null;
  /** Synth time of `startBeat` on each pass round the loop (the newest last). */
  private passes: number[] = [];
  private noteCursor = 0;
  private clickCursor = 0;
  private endAt: number | null = null;
  private running = false;

  constructor(
    private readonly synth: PlayerSynth,
    private readonly song: Pick<Song, 'tempos' | 'bars'>,
  ) {}

  get playing(): boolean {
    return this.running;
  }

  start(opts: PlayOptions): void {
    const speed = Math.min(1, Math.max(MIN_SPEED, opts.speed));
    this.opts = { ...opts, speed };
    const at = opts.at ?? this.synth.now() + START_DELAY;
    let t0 = at;
    if (opts.countIn) {
      // One bar of clicks at the start bar's meter and the song's tempo there.
      const bar = this.song.bars.find(
        (b) => b.beat <= opts.startBeat + 1e-6 && opts.startBeat < b.beat + b.beats,
      );
      const beats = Math.max(1, Math.round(bar?.beats ?? 4));
      const beatSec =
        (secAt(this.song, opts.startBeat + 1) - secAt(this.song, opts.startBeat)) / speed;
      for (let i = 0; i < beats; i++) this.synth.tick(at + i * beatSec, i === 0);
      t0 = at + beats * beatSec;
    }
    this.passes = [t0];
    this.resetCursors();
    this.endAt = null;
    this.running = true;
    this.pump();
  }

  /** Synth time of `beat` in the current pass. */
  private timeOf(beat: number): number {
    const o = this.opts;
    const t0 = this.passes.at(-1) ?? 0;
    if (!o) return t0;
    return t0 + (secAt(this.song, beat) - secAt(this.song, o.startBeat)) / o.speed;
  }

  private resetCursors(): void {
    const o = this.opts;
    if (!o) return;
    this.noteCursor = o.notes.findIndex((n) => n.beat >= o.startBeat - 1e-6);
    if (this.noteCursor < 0) this.noteCursor = o.notes.length;
    this.clickCursor = Math.ceil(o.startBeat - 1e-6);
  }

  /** Schedule everything that starts before now + LOOKAHEAD; loop or finish at the end. */
  pump(): void {
    const o = this.opts;
    if (!this.running || !o) return;
    const now = this.synth.now();
    if (this.endAt !== null) {
      if (now >= this.endAt) this.running = false;
      return;
    }
    const horizon = now + LOOKAHEAD;
    for (let guard = 0; guard < 4; guard++) {
      while (this.noteCursor < o.notes.length) {
        const n = o.notes[this.noteCursor];
        if (!n || n.beat >= o.endBeat - 1e-6) {
          this.noteCursor = o.notes.length;
          break;
        }
        const at = this.timeOf(n.beat);
        if (at >= horizon) break;
        const dur = (secAt(this.song, n.beat + n.dur) - secAt(this.song, n.beat)) / o.speed;
        this.synth.playMidi([n.midi], at, Math.max(0.05, dur), n.velocity);
        this.noteCursor += 1;
      }
      if (o.click) {
        while (this.clickCursor < o.endBeat - 1e-6) {
          const at = this.timeOf(this.clickCursor);
          if (at >= horizon) break;
          this.synth.tick(at, barAt(this.song, this.clickCursor).beatInBar < 1e-6);
          this.clickCursor += 1;
        }
      }
      const endTime = this.timeOf(o.endBeat);
      const done =
        this.noteCursor >= o.notes.length && (!o.click || this.clickCursor >= o.endBeat - 1e-6);
      if (!done || endTime >= horizon) return;
      if (!o.loop) {
        this.endAt = endTime;
        return;
      }
      this.passes.push(endTime);
      if (this.passes.length > 8) this.passes.shift();
      this.resetCursors();
    }
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.synth.stop();
  }

  /** The song beat sounding at synth time `time`: null before the first beat (count-in). */
  beatAt(time: number): number | null {
    const o = this.opts;
    if (!o) return null;
    const t0 = [...this.passes].reverse().find((t) => t <= time);
    if (t0 === undefined) return null;
    const beat = beatAtSec(this.song, secAt(this.song, o.startBeat) + (time - t0) * o.speed);
    return Math.min(beat, o.endBeat);
  }
}
