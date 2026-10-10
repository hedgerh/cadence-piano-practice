import type { Midi } from '@cadence/music';
import type { SoundVoice } from '@shared/ipc/contracts';
import { appSynth } from '../audio/useAudio';
import { WebAudioSynth } from '../audio/WebAudioSynth';
import type { RuntimeMode } from '../lib/runtimeMode';
import type { FakeMidiInput } from '../midi/FakeMidiInput';
import { createFakeMidiAccess, type FakeMidiAccess } from '../midi/fakeMidiAccess';
import type { MidiDeviceInfo, MidiStatus } from '../midi/MidiInput';
import { appMidi } from '../midi/midiStore';
import { WebMidiInput } from '../midi/WebMidiInput';

/** `window.__cadenceDev` — only installed in dev or e2e runs (see lib/runtimeMode.ts). */
export interface CadenceDevHooks {
  mode: RuntimeMode;
  midi: {
    press(midi: Midi, velocity?: number): void;
    release(midi: Midi): void;
    releaseAll(): void;
    held(): Midi[];
    status(): MidiStatus;
    /**
     * Task 16: replace the real Web MIDI device with a WebMidiInput over a fake MIDIAccess
     * holding these ports (`[]` = no keyboard), so e2e can exercise the picker, hot-plug and the
     * no-device path deterministically on any machine.
     */
    fakeDevices(devices: MidiDeviceInfo[]): void;
    plug(device: MidiDeviceInfo): void;
    unplug(id: string): void;
    /** Raw bytes from a fake port (only heard while WebMidiInput listens to it). */
    sendFrom(id: string, bytes: number[]): void;
    /** Fake ports with a message handler attached. */
    listening(): string[];
    devices(): MidiDeviceInfo[];
  };
  audio: {
    /** Unlocks the synth (decoding the piano samples) and reports the voice that will play. */
    voice(): Promise<SoundVoice | 'silent'>;
  };
  /** Set by the ear drill while mounted (features/ear/useEarDrill.ts); e2e reads the target. */
  ear?: {
    currentAnswer: string | null;
    stepId: string | null;
    /** MIDI numbers of the current prompt sound. */
    notes: number[];
    q: number;
    phase: string;
    /** Find the key: the tonic's pitch class (0–11). */
    tonicPc?: number;
    /** Find the key: the mode answer ('major' | 'minor'). */
    answer?: string | null;
    /** Find the key: home has been found. */
    found?: boolean;
  };
}

declare global {
  interface Window {
    __cadenceDev?: CadenceDevHooks;
  }
}

export function installDevHooks(input: FakeMidiInput, mode: RuntimeMode): void {
  let fake: FakeMidiAccess | null = null;
  const requireFake = (): FakeMidiAccess => {
    if (!fake) throw new Error('call __cadenceDev.midi.fakeDevices() first');
    return fake;
  };
  window.__cadenceDev = {
    mode,
    midi: {
      press: (midi, velocity = 96) => input.press(midi, velocity),
      release: (midi) => input.release(midi),
      releaseAll: () => input.stop(),
      held: () => [...appMidi.store.getState().held].sort((a, b) => a - b),
      status: () => appMidi.store.getState().status,
      fakeDevices: (devices) => {
        fake = createFakeMidiAccess(devices);
        appMidi.replaceDevice(new WebMidiInput(fake.navigator));
      },
      plug: (device) => requireFake().plug(device),
      unplug: (id) => requireFake().unplug(id),
      sendFrom: (id, bytes) => requireFake().send(id, bytes),
      listening: () => requireFake().listening(),
      devices: () => [...appMidi.store.getState().devices],
    },
    audio: {
      voice: async () => {
        if (!(appSynth instanceof WebAudioSynth)) return 'silent';
        await appSynth.unlock();
        return appSynth.voice;
      },
    },
  };
}
