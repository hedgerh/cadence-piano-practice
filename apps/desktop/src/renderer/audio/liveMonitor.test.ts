// decisions.md 2026-10-13 "Play my notes": MIDI note events and the pedal reach the synth.
import { describe, expect, it } from 'vitest';
import { emitter, writable } from '../midi/signal';
import type { NoteEvent } from '../midi/MidiInput';
import { installLiveMonitor } from './liveMonitor';
import { NullSynth } from './NullSynth';

function fakeHub() {
  const events = emitter<NoteEvent>();
  const sustain = emitter<boolean>();
  return {
    events,
    sustain,
    hub: {
      subscribeEvents: (l: (e: NoteEvent) => void) => events.subscribe(l),
      subscribeSustain: (l: (down: boolean) => void) => sustain.subscribe(l),
    },
  };
}

const on = (midi: number, velocity = 90): NoteEvent => ({ type: 'on', midi, velocity, at: 0 });
const off = (midi: number): NoteEvent => ({ type: 'off', midi, velocity: 0, at: 0 });

describe('installLiveMonitor', () => {
  it('key down → noteOn with velocity, key up → noteOff, pedal → setSustain', () => {
    const { events, sustain, hub } = fakeHub();
    const synth = new NullSynth();
    installLiveMonitor(hub, synth, writable(true));
    events.emit(on(60, 72));
    sustain.emit(true);
    events.emit(off(60));
    sustain.emit(false);
    expect(synth.live).toEqual([
      ['on', 60, 72],
      ['sustain', true],
      ['off', 60],
      ['sustain', false],
    ]);
  });

  it('switched off: keys make no sound, but a note already ringing still stops', () => {
    const { events, hub } = fakeHub();
    const synth = new NullSynth();
    const enabled = writable(true);
    installLiveMonitor(hub, synth, enabled);
    events.emit(on(60));
    enabled.set(false);
    events.emit(on(64));
    events.emit(off(60));
    expect(synth.live).toEqual([
      ['on', 60, 90],
      ['off', 60],
    ]);
  });

  it('unsubscribes', () => {
    const { events, hub } = fakeHub();
    const synth = new NullSynth();
    installLiveMonitor(hub, synth, writable(true))();
    events.emit(on(60));
    expect(synth.live).toEqual([]);
  });
});
