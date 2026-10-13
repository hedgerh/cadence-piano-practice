// decisions.md 2026-10-13 "Play my notes": the keys the learner plays sound through the app,
// in the Sound setting's voice, so a controller with no speakers (or no Ableton running) is
// heard. Every heard MIDI input feeds the synth directly — no React in the path, for latency.
// "Play my notes" (on by default; off for keyboards with their own sound) is a per-computer
// preference in localStorage, since it depends on the hardware plugged in.
import { useSyncExternalStore } from 'react';
import type { MidiHub } from '../midi/midiStore';
import { writable, type Readable, type Writable } from '../midi/signal';
import type { Synth } from './Synth';

export const PLAY_MY_NOTES_KEY = 'cadence.playMyNotes';

function readPreference(): boolean {
  try {
    return localStorage.getItem(PLAY_MY_NOTES_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Whether the learner's own notes sound (the MIDI menu's "Play my notes" switch). */
export const playMyNotes: Writable<boolean> = writable(readPreference());

export function setPlayMyNotes(on: boolean): void {
  playMyNotes.set(on);
  try {
    localStorage.setItem(PLAY_MY_NOTES_KEY, on ? 'on' : 'off');
  } catch {
    // Storage unavailable: the choice lasts until the app closes.
  }
}

export function usePlayMyNotes(): boolean {
  return useSyncExternalStore(
    (onChange) => playMyNotes.subscribe(onChange),
    () => playMyNotes.get(),
  );
}

/**
 * Key down → `synth.noteOn` (when enabled), key up → `noteOff` (always, so a note started
 * before the switch went off still stops), pedal → `setSustain`. Returns an unsubscribe.
 */
export function installLiveMonitor(
  hub: Pick<MidiHub, 'subscribeEvents' | 'subscribeSustain'>,
  synth: Pick<Synth, 'noteOn' | 'noteOff' | 'setSustain'>,
  enabled: Readable<boolean> = playMyNotes,
): () => void {
  const offEvents = hub.subscribeEvents((e) => {
    if (e.type === 'on') {
      if (enabled.get()) synth.noteOn(e.midi, e.velocity);
    } else {
      synth.noteOff(e.midi);
    }
  });
  const offSustain = hub.subscribeSustain((down) => synth.setSustain(down));
  return () => {
    offEvents();
    offSustain();
  };
}
