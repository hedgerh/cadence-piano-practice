import { FakeMidiInput } from './FakeMidiInput';
import { KeyboardMidiInput } from './KeyboardMidiInput';
import { appMidi } from './midiStore';
import { WebMidiInput } from './WebMidiInput';

let devInput: FakeMidiInput | null = null;

/**
 * Wire the app hub: real device first, computer keyboard as the fallback (always heard in
 * dev), plus a scripted FakeMidiInput in dev/e2e for `window.__cadenceDev.midi`.
 * Returns that fake (or null outside dev/e2e).
 */
export function initAppMidi(opts: { dev: boolean; devTools: boolean }): FakeMidiInput | null {
  appMidi.setKeyboardAlways(opts.dev);
  appMidi.attach(new WebMidiInput(), 'device');
  appMidi.attach(new KeyboardMidiInput(), 'fallback');
  if (opts.devTools && !devInput) {
    devInput = new FakeMidiInput({ kind: 'connected', deviceName: 'Dev hooks', deviceId: 'dev' });
    appMidi.attach(devInput, 'dev');
  }
  void appMidi.start();
  return devInput;
}
