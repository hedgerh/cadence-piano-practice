// docs/engine.md §7 — the synth port. WebAudioSynth plays; NullSynth records for tests.
import type { Sound } from '@cadence/content';
import type { Midi } from '@cadence/music';
import type { SoundVoice } from '@shared/ipc/contracts';

export interface PlayOptions {
  /** Called when the sound's last note has finished (or `stop()` cut it short). */
  onEnd?: () => void;
}

export interface Synth {
  /** Resume the audio context; call from a user gesture (and inside every play). */
  unlock(): Promise<void>;
  /** Schedule a content Sound (via player.ts); resolves when it has finished sounding. */
  play(sound: Sound, opts?: PlayOptions): Promise<void>;
  /** Schedule notes together at absolute synth time `at` (seconds) for `dur` seconds. */
  playMidi(notes: readonly Midi[], at: number, dur: number): void;
  /** Current synth clock in seconds (AudioContext.currentTime). */
  now(): number;
  /** Silence everything and resolve pending plays. */
  stop(): void;
  /** Master volume, 0..1. */
  setVolume(volume: number): void;
  /** The Sound setting: recorded piano, synthesized piano or the basic tone. */
  setVoice(voice: SoundVoice): void;
}
