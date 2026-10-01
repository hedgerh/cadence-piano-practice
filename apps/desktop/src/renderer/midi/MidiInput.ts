// docs/ui.md §4 — the MIDI input port the renderer listens to. Implementations:
// WebMidiInput (real device), KeyboardMidiInput (computer keyboard), FakeMidiInput (tests/e2e).
import type { Midi } from '@cadence/music';
import { emitter, writable, type Readable, type Stream } from './signal';

export type MidiStatus =
  | { kind: 'unsupported' }
  | { kind: 'requesting' }
  | { kind: 'denied' }
  | { kind: 'no-device' }
  | { kind: 'connected'; deviceName: string; deviceId: string };

export interface NoteEvent {
  type: 'on' | 'off';
  midi: Midi;
  /** 0..127; note-off events carry 0. */
  velocity: number;
  /** `performance.now()` milliseconds. */
  at: number;
}

export interface MidiInput {
  readonly status$: Readable<MidiStatus>;
  readonly held$: Readable<ReadonlySet<Midi>>;
  readonly events$: Stream<NoteEvent>;
  start(): Promise<void>;
  stop(): void;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Shared bookkeeping: `held$` is derived from the note events an input emits, and
 * `releaseAll()` emits note-offs for whatever is still down (disconnect, blur, stop).
 */
export abstract class BaseMidiInput implements MidiInput {
  protected readonly status = writable<MidiStatus>({ kind: 'no-device' });
  protected readonly held = writable<ReadonlySet<Midi>>(new Set());
  protected readonly events = emitter<NoteEvent>();

  get status$(): Readable<MidiStatus> {
    return this.status;
  }
  get held$(): Readable<ReadonlySet<Midi>> {
    return this.held;
  }
  get events$(): Stream<NoteEvent> {
    return this.events;
  }

  abstract start(): Promise<void>;
  abstract stop(): void;

  protected noteOn(midi: Midi, velocity: number): void {
    // MIDI 1.0: note-on with velocity 0 is a note-off.
    if (velocity <= 0) {
      this.noteOff(midi);
      return;
    }
    const next = new Set(this.held.get());
    next.add(midi);
    this.held.set(next);
    this.events.emit({ type: 'on', midi, velocity, at: now() });
  }

  protected noteOff(midi: Midi): void {
    const current = this.held.get();
    if (!current.has(midi)) return;
    const next = new Set(current);
    next.delete(midi);
    this.held.set(next);
    this.events.emit({ type: 'off', midi, velocity: 0, at: now() });
  }

  protected releaseAll(): void {
    for (const midi of [...this.held.get()]) this.noteOff(midi);
  }
}
