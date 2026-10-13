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
  /** Sustain pedal (CC64 ≥ 64) is down (decisions.md 2026-10-13 "Play my notes"). */
  readonly sustain$: Readable<boolean>;
  start(): Promise<void>;
  stop(): void;
}

/** A connected MIDI input port, as listed in the MidiPill's device picker (Task 16). */
export interface MidiDeviceInfo {
  id: string;
  name: string;
}

/**
 * The learner's chosen keyboard (`me.update {midi}`), restored on launch. Matched by id first,
 * then by name (port ids can change when a device moves to another USB socket).
 */
export interface MidiDevicePreference {
  id: string | null;
  name: string | null;
}

/** An input that owns several ports and listens to one of them (WebMidiInput). */
export interface SelectableMidiInput extends MidiInput {
  /** Every connected input port. */
  readonly devices$: Readable<readonly MidiDeviceInfo[]>;
  /** Listen to the preferred port when it is connected, else the first connected one. */
  select(preference: MidiDevicePreference | null): void;
}

export function isSelectable(input: MidiInput): input is SelectableMidiInput {
  return 'select' in input && 'devices$' in input;
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
  protected readonly sustain = writable(false);

  get status$(): Readable<MidiStatus> {
    return this.status;
  }
  get held$(): Readable<ReadonlySet<Midi>> {
    return this.held;
  }
  get events$(): Stream<NoteEvent> {
    return this.events;
  }
  get sustain$(): Readable<boolean> {
    return this.sustain;
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
    this.sustain.set(false);
  }
}
