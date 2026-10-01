import type { Midi } from '@cadence/music';
import type { RuntimeMode } from '../lib/runtimeMode';
import type { FakeMidiInput } from '../midi/FakeMidiInput';
import type { MidiStatus } from '../midi/MidiInput';
import { appMidi } from '../midi/midiStore';

/** `window.__cadenceDev` — only installed in dev or e2e runs (see lib/runtimeMode.ts). */
export interface CadenceDevHooks {
  mode: RuntimeMode;
  midi: {
    press(midi: Midi, velocity?: number): void;
    release(midi: Midi): void;
    releaseAll(): void;
    held(): Midi[];
    status(): MidiStatus;
  };
  /** Set by the ear drill while mounted (features/ear/useEarDrill.ts); e2e reads the target. */
  ear?: {
    currentAnswer: string | null;
    stepId: string | null;
    /** MIDI numbers of the current prompt sound. */
    notes: number[];
    q: number;
    phase: string;
  };
}

declare global {
  interface Window {
    __cadenceDev?: CadenceDevHooks;
  }
}

export function installDevHooks(input: FakeMidiInput, mode: RuntimeMode): void {
  window.__cadenceDev = {
    mode,
    midi: {
      press: (midi, velocity = 96) => input.press(midi, velocity),
      release: (midi) => input.release(midi),
      releaseAll: () => input.stop(),
      held: () => [...appMidi.store.getState().held].sort((a, b) => a - b),
      status: () => appMidi.store.getState().status,
    },
  };
}
