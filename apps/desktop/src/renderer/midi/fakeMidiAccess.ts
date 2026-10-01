// A scriptable stand-in for Web MIDI's MIDIAccess (Task 16): unit tests and the e2e dev hooks
// (`window.__cadenceDev.midi.devices`) drive the real WebMidiInput through it — plug and unplug
// ports, and send raw note bytes from a port — without hardware.
import type { MidiDeviceInfo } from './MidiInput';

type MessageHandler = ((e: { data: Uint8Array }) => void) | null;

interface FakePort {
  id: string;
  name: string;
  state: 'connected' | 'disconnected';
  onmidimessage: MessageHandler;
}

export interface FakeMidiAccess {
  /** What `requestMIDIAccess` resolves to (cast for WebMidiInput's constructor). */
  readonly navigator: Pick<Navigator, 'requestMIDIAccess'>;
  /** Connect a port (a new one, or one unplugged earlier) and fire `statechange`. */
  plug(device: MidiDeviceInfo): void;
  /** Disconnect a port and fire `statechange`. */
  unplug(id: string): void;
  /** Raw MIDI bytes from a port; ignored unless WebMidiInput is listening to it. */
  send(id: string, bytes: readonly number[]): void;
  /** Ports WebMidiInput is currently listening to (has a message handler). */
  listening(): string[];
}

export function createFakeMidiAccess(initial: readonly MidiDeviceInfo[] = []): FakeMidiAccess {
  const inputs = new Map<string, FakePort>();
  for (const d of initial) {
    inputs.set(d.id, { ...d, state: 'connected', onmidimessage: null });
  }
  // WebMidiInput assigns `onstatechange` through a cast the bundler cannot see; with a plain
  // `onstatechange: null` field Rollup folds every read to null and drops the dispatch in the
  // production build. An accessor pair keeps the handler opaque to that optimisation.
  let onstatechange: (() => void) | null = null;
  const access = {
    inputs,
    get onstatechange(): (() => void) | null {
      return onstatechange;
    },
    set onstatechange(handler: (() => void) | null) {
      onstatechange = handler;
    },
  };
  const fire = (): void => onstatechange?.();

  return {
    navigator: {
      requestMIDIAccess: () => Promise.resolve(access as unknown as MIDIAccess),
    },
    plug(device) {
      const existing = inputs.get(device.id);
      if (existing) {
        existing.state = 'connected';
        existing.name = device.name;
      } else {
        inputs.set(device.id, { ...device, state: 'connected', onmidimessage: null });
      }
      fire();
    },
    unplug(id) {
      const port = inputs.get(id);
      if (!port) return;
      port.state = 'disconnected';
      fire();
    },
    send(id, bytes) {
      const port = inputs.get(id);
      if (port?.state !== 'connected') return;
      port.onmidimessage?.({ data: new Uint8Array(bytes) });
    },
    listening: () => [...inputs.values()].filter((p) => p.onmidimessage).map((p) => p.id),
  };
}
