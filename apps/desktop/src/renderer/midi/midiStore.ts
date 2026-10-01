// docs/ui.md §4 — composes the real device with the computer-keyboard fallback (and, in
// dev/e2e, a FakeMidiInput driven by window.__cadenceDev.midi) into one Zustand store.
import type { Midi } from '@cadence/music';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { MidiInput, MidiStatus, NoteEvent } from './MidiInput';
import { emitter } from './signal';

/**
 * - `device`: the real keyboard. Its status is the app's MIDI status (the pill).
 * - `fallback`: the computer keyboard; heard only when no device is connected, or always
 *   when `keyboardAlways` (dev).
 * - `dev`: scripted input (tests, e2e); always heard.
 */
export type MidiRole = 'device' | 'fallback' | 'dev';

export interface MidiState {
  status: MidiStatus;
  /** MIDI numbers currently down, across every input that is being heard. */
  held: ReadonlySet<Midi>;
  /** The most recent note events (newest last), capped at EVENT_HISTORY. */
  events: readonly NoteEvent[];
  /** Whether the computer-keyboard fallback is currently heard. */
  keyboardActive: boolean;
}

export const EVENT_HISTORY = 32;

export interface MidiHub {
  readonly store: StoreApi<MidiState>;
  attach(input: MidiInput, role: MidiRole): () => void;
  start(): Promise<void>;
  stop(): void;
  /** Note events from every heard input, as they happen. */
  subscribeEvents(listener: (e: NoteEvent) => void): () => void;
  setKeyboardAlways(on: boolean): void;
}

interface Attached {
  input: MidiInput;
  role: MidiRole;
  unsubscribe: () => void;
}

const EMPTY: ReadonlySet<Midi> = new Set();

function sameSet(a: ReadonlySet<Midi>, b: ReadonlySet<Midi>): boolean {
  if (a.size !== b.size) return false;
  for (const m of a) if (!b.has(m)) return false;
  return true;
}

export function createMidiHub(options: { keyboardAlways?: boolean } = {}): MidiHub {
  let keyboardAlways = options.keyboardAlways ?? false;
  const attached: Attached[] = [];
  const events = emitter<NoteEvent>();
  let started = false;

  const store = createStore<MidiState>(() => ({
    status: { kind: 'no-device' },
    held: EMPTY,
    events: [],
    keyboardActive: true,
  }));

  const deviceStatus = (): MidiStatus => {
    const device = attached.find((a) => a.role === 'device');
    return device ? device.input.status$.get() : { kind: 'no-device' };
  };

  const isHeard = (a: Attached): boolean => {
    if (a.role !== 'fallback') return true;
    return keyboardAlways || deviceStatus().kind !== 'connected';
  };

  const recompute = (): void => {
    const held = new Set<Midi>();
    for (const a of attached) {
      if (!isHeard(a)) continue;
      for (const m of a.input.held$.get()) held.add(m);
    }
    const prev = store.getState();
    const status = deviceStatus();
    const keyboardActive = keyboardAlways || status.kind !== 'connected';
    store.setState({
      status,
      held: sameSet(prev.held, held) ? prev.held : held,
      keyboardActive,
    });
  };

  return {
    store,
    attach(input, role) {
      const entry: Attached = { input, role, unsubscribe: () => undefined };
      const unsubs = [
        input.status$.subscribe(recompute),
        input.held$.subscribe(recompute),
        input.events$.subscribe((e) => {
          if (!isHeard(entry)) return;
          const prev = store.getState().events;
          store.setState({ events: [...prev, e].slice(-EVENT_HISTORY) });
          events.emit(e);
        }),
      ];
      entry.unsubscribe = () => unsubs.forEach((u) => u());
      attached.push(entry);
      recompute();
      if (started) void input.start();
      return () => {
        entry.unsubscribe();
        const i = attached.indexOf(entry);
        if (i >= 0) attached.splice(i, 1);
        recompute();
      };
    },
    async start() {
      started = true;
      await Promise.all(attached.map((a) => a.input.start()));
      recompute();
    },
    stop() {
      started = false;
      for (const a of attached) a.input.stop();
      recompute();
    },
    subscribeEvents: (listener) => events.subscribe(listener),
    setKeyboardAlways(on) {
      keyboardAlways = on;
      recompute();
    },
  };
}

/** The app-wide hub. Inputs are attached at startup by `initAppMidi` (main.tsx). */
export const appMidi: MidiHub = createMidiHub();
