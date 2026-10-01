import type { Sound } from '@cadence/content';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { NullSynth } from './NullSynth';
import type { Synth } from './Synth';
import { WebAudioSynth } from './WebAudioSynth';

/** The app synth. WebAudio when available (Electron), silent elsewhere (jsdom). */
export const appSynth: Synth =
  typeof AudioContext !== 'undefined' ? new WebAudioSynth() : new NullSynth();

export const SynthContext = createContext<Synth>(appSynth);

/** Resume the AudioContext on the first user gesture (ui.md §4). */
export function installAudioUnlock(synth: Synth = appSynth): () => void {
  const unlock = () => {
    void synth.unlock();
    remove();
  };
  const remove = () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  return remove;
}

export interface AudioApi {
  synth: Synth;
  /** Play a content Sound; resolves when it has finished. */
  play: (sound: Sound) => Promise<void>;
  /** True while any sound started from this hook is still sounding. */
  playing: boolean;
  stop: () => void;
}

export function useAudio(): AudioApi {
  const synth = useContext(SynthContext);
  const [playing, setPlaying] = useState(false);
  const inFlight = useRef(0);

  const play = useCallback(
    async (sound: Sound) => {
      inFlight.current += 1;
      setPlaying(true);
      try {
        await synth.play(sound);
      } finally {
        inFlight.current -= 1;
        if (inFlight.current === 0) setPlaying(false);
      }
    },
    [synth],
  );

  const stop = useCallback(() => synth.stop(), [synth]);

  return { synth, play, playing, stop };
}
