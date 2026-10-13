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
  /**
   * Live playing (decisions.md 2026-10-13 "Play my notes"): a key went down with MIDI
   * `velocity` (1..127). The note sounds in the current voice until `noteOff` (or the pedal
   * lets it go). `stop()` never cuts live notes.
   */
  noteOn(midi: Midi, velocity: number): void;
  noteOff(midi: Midi): void;
  /** Sustain pedal (CC64): while down, released keys keep sounding. */
  setSustain(down: boolean): void;
}
