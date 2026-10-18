// The Jam transport (decisions.md 2026-10-18 "Jam"): a look-ahead scheduler. `pump()` (called
// every ~25 ms) schedules every beat that starts before now + LOOKAHEAD on the synth clock, one
// beat at a time, so nothing is scheduled twice and a tempo change applies from the next beat.
import type { JamChart } from '@cadence/content';
import type { Midi } from '@cadence/music';
import type { Synth } from '../../audio/Synth';
import {
  COUNT_IN_BEATS,
  backingVoicings,
  beatSec,
  eventsForBeat,
  loopBeats,
  type JamSettings,
} from './jamTiming';

/** How far ahead beats are scheduled, seconds. */
export const LOOKAHEAD = 0.2;
/** First beat starts this long after Start, so its notes are never late. */
export const START_DELAY = 0.1;
const LOG_SIZE = 64;

export type TransportSynth = Pick<Synth, 'now' | 'playMidi' | 'tick' | 'stop'>;

export interface TransportHooks {
  /** Called as each loop's first beat is scheduled (the recorder starts takes on it). */
  onLoopStart?: (loop: number, at: number) => void;
  /** Called once the last scheduled loop has finished (take playback). */
  onEnd?: () => void;
}

export interface StartOptions {
  countIn: boolean;
  /** Stop after this many loops (take playback); omitted = loop until stopped. */
  loops?: number;
  /** Start at this synth time (defaults to now + START_DELAY). */
  at?: number;
}

export class JamTransport {
  /** The chart being played (set by `update`). */
  chart: Pick<JamChart, 'chords' | 'bars'> | null = null;
  private voicings: Midi[][] = [];
  private settings: JamSettings = { bpm: 80, comp: 'held', click: true };
  private nextBeat = 0;
  private nextTime = 0;
  private endBeat: number | null = null;
  private running = false;
  /** Scheduled beats, newest last: what the screen follows. */
  private readonly log: { beat: number; at: number }[] = [];
  private endAt: number | null = null;

  constructor(
    private readonly synth: TransportSynth,
    private hooks: TransportHooks = {},
  ) {}

  /** Replace the loop-start / end callbacks (the screen re-registers them as it renders). */
  setHooks(hooks: TransportHooks): void {
    this.hooks = hooks;
  }

  /** The chart and settings to play; safe to call while playing (applies from the next beat). */
  update(chart: Pick<JamChart, 'chords' | 'bars'>, settings: JamSettings): void {
    if (chart !== this.chart) {
      this.chart = chart;
      this.voicings = backingVoicings(chart);
    }
    this.settings = settings;
  }

  get playing(): boolean {
    return this.running;
  }

  get bpm(): number {
    return this.settings.bpm;
  }

  start(opts: StartOptions): void {
    if (!this.chart) return;
    this.running = true;
    this.log.length = 0;
    this.nextBeat = opts.countIn ? -COUNT_IN_BEATS : 0;
    this.nextTime = opts.at ?? this.synth.now() + START_DELAY;
    this.endBeat = opts.loops === undefined ? null : opts.loops * loopBeats(this.chart);
    this.endAt = null;
    this.pump();
  }

  /** Schedule every beat starting before now + LOOKAHEAD; finish a bounded run. */
  pump(): void {
    if (!this.running || !this.chart) return;
    const now = this.synth.now();
    if (this.endAt !== null && now >= this.endAt) {
      this.running = false;
      this.hooks.onEnd?.();
      return;
    }
    while (this.nextTime < now + LOOKAHEAD) {
      if (this.endBeat !== null && this.nextBeat >= this.endBeat) {
        this.endAt ??= this.nextTime;
        return;
      }
      const beat = this.nextBeat;
      const at = this.nextTime;
      for (const ev of eventsForBeat(this.chart, this.voicings, this.settings, beat, at)) {
        if (ev.kind === 'tick') this.synth.tick(ev.at, ev.accent);
        else this.synth.playMidi(ev.notes, ev.at, ev.dur, ev.velocity);
      }
      if (beat >= 0 && beat % loopBeats(this.chart) === 0) {
        this.hooks.onLoopStart?.(beat / loopBeats(this.chart), at);
      }
      this.log.push({ beat, at });
      if (this.log.length > LOG_SIZE) this.log.shift();
      this.nextBeat += 1;
      this.nextTime += beatSec(this.settings.bpm);
    }
  }

  /** Stop scheduling and silence the backing (live notes are never cut). */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.synth.stop();
  }

  /** The beat sounding at synth time `time` (negative during the count-in), or null. */
  beatAt(time: number): number | null {
    for (let i = this.log.length - 1; i >= 0; i--) {
      const entry = this.log[i];
      if (entry && entry.at <= time) return entry.beat;
    }
    return null;
  }
}
