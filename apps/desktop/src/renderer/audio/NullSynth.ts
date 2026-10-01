import type { Sound } from '@cadence/content';
import type { Midi } from '@cadence/music';
import { playSound } from './player';
import type { PlayOptions, Synth } from './Synth';

export interface RecordedNote {
  midi: Midi;
  /** Absolute synth time, seconds. */
  at: number;
  dur: number;
}

/** Silent synth that records every `(midi, at, dur)` it is asked to play (tests, jsdom). */
export class NullSynth implements Synth {
  readonly calls: RecordedNote[] = [];
  readonly sounds: Sound[] = [];
  volume = 1;
  unlocked = false;
  /** Synth clock; tests may set it. */
  time = 0;

  unlock(): Promise<void> {
    this.unlocked = true;
    return Promise.resolve();
  }

  play(sound: Sound, opts?: PlayOptions): Promise<void> {
    this.sounds.push(sound);
    playSound(this, sound);
    opts?.onEnd?.();
    return Promise.resolve();
  }

  playMidi(notes: readonly Midi[], at: number, dur: number): void {
    for (const midi of notes) this.calls.push({ midi, at, dur });
  }

  now(): number {
    return this.time;
  }

  stop(): void {
    // Nothing is sounding.
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
  }

  clear(): void {
    this.calls.length = 0;
    this.sounds.length = 0;
  }
}
