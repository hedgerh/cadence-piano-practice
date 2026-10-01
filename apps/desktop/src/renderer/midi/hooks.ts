import type { Midi } from '@cadence/music';
import { createContext, useContext, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import type { MidiStatus, NoteEvent } from './MidiInput';
import { appMidi, type MidiHub } from './midiStore';

/** Lets tests (and the gallery, if needed) swap the hub; defaults to the app hub. */
export const MidiHubContext = createContext<MidiHub>(appMidi);

export function useMidiHub(): MidiHub {
  return useContext(MidiHubContext);
}

export function useMidiStatus(): MidiStatus {
  return useStore(useMidiHub().store, (s) => s.status);
}

export function useHeldNotes(): ReadonlySet<Midi> {
  return useStore(useMidiHub().store, (s) => s.held);
}

export function useKeyboardFallbackActive(): boolean {
  return useStore(useMidiHub().store, (s) => s.keyboardActive);
}

/** Calls `listener` for every heard note event while mounted. Latest listener wins. */
export function useMidiEvents(listener: (e: NoteEvent) => void): void {
  const hub = useMidiHub();
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => hub.subscribeEvents((e) => latest.current(e)), [hub]);
}
