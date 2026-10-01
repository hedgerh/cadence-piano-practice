import type { Midi } from '@cadence/music';
import { BaseMidiInput, type MidiStatus } from './MidiInput';

/**
 * A scriptable input for unit tests and `window.__cadenceDev.midi` (dev/e2e only).
 * Raw `send()` mirrors the Web MIDI byte handling so tests can exercise velocity 0.
 */
export class FakeMidiInput extends BaseMidiInput {
  constructor(
    initial: MidiStatus = { kind: 'connected', deviceName: 'Fake keyboard', deviceId: 'fake' },
  ) {
    super();
    this.status.set(initial);
  }

  start(): Promise<void> {
    return Promise.resolve();
  }

  stop(): void {
    this.releaseAll();
  }

  press(midi: Midi, velocity = 96): void {
    this.noteOn(midi, velocity);
  }

  release(midi: Midi): void {
    this.noteOff(midi);
  }

  /** Raw note-on/off: `0x90` with velocity 0 is an off, like WebMidiInput. */
  send(status: number, midi: Midi, velocity: number): void {
    const kind = status & 0xf0;
    if (kind === 0x90) this.noteOn(midi, velocity);
    else if (kind === 0x80) this.noteOff(midi);
  }

  connect(deviceName = 'Fake keyboard', deviceId = 'fake'): void {
    this.status.set({ kind: 'connected', deviceName, deviceId });
  }

  /** Unplugging clears every held note (ui.md §4). */
  disconnect(): void {
    this.releaseAll();
    this.status.set({ kind: 'no-device' });
  }

  setStatus(status: MidiStatus): void {
    if (status.kind !== 'connected') this.releaseAll();
    this.status.set(status);
  }
}
