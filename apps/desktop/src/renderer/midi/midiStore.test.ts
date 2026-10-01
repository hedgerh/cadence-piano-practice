import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeMidiInput } from './FakeMidiInput';
import type { NoteEvent } from './MidiInput';
import { createMidiHub, type MidiHub } from './midiStore';

// docs/ui.md §4 / docs/engine.md §5: reducers consume the held set (HELD_CHANGED) and events.
describe('midiStore with FakeMidiInput', () => {
  let hub: MidiHub;
  afterEach(() => hub.stop());

  function setup() {
    hub = createMidiHub();
    const device = new FakeMidiInput();
    hub.attach(device, 'device');
    return { device, held: () => [...hub.store.getState().held].sort((a, b) => a - b) };
  }

  it('note-on adds to held', () => {
    const { device, held } = setup();
    device.send(0x90, 60, 100);
    device.send(0x90, 64, 90);
    expect(held()).toEqual([60, 64]);
  });

  it('note-off removes from held', () => {
    const { device, held } = setup();
    device.send(0x90, 60, 100);
    device.send(0x90, 64, 100);
    device.send(0x80, 60, 0);
    expect(held()).toEqual([64]);
  });

  it('note-on with velocity 0 is a note-off', () => {
    const { device, held } = setup();
    device.send(0x90, 67, 80);
    device.send(0x90, 67, 0);
    expect(held()).toEqual([]);
    const types = hub.store.getState().events.map((e) => e.type);
    expect(types).toEqual(['on', 'off']);
  });

  it('ignores other channel messages (sustain CC64)', () => {
    const { device, held } = setup();
    device.send(0xb0, 64, 127);
    expect(held()).toEqual([]);
  });

  it('disconnect clears held and reports no-device', () => {
    const { device, held } = setup();
    device.press(60);
    device.press(64);
    device.disconnect();
    expect(held()).toEqual([]);
    expect(hub.store.getState().status).toEqual({ kind: 'no-device' });
  });

  it('status mirrors the device', () => {
    const { device } = setup();
    expect(hub.store.getState().status).toEqual({
      kind: 'connected',
      deviceName: 'Fake keyboard',
      deviceId: 'fake',
    });
    device.setStatus({ kind: 'denied' });
    expect(hub.store.getState().status.kind).toBe('denied');
  });

  it('streams events to subscribers', () => {
    const { device } = setup();
    const seen: NoteEvent[] = [];
    hub.subscribeEvents((e) => seen.push(e));
    device.press(62, 70);
    device.release(62);
    expect(seen.map((e) => [e.type, e.midi, e.velocity])).toEqual([
      ['on', 62, 70],
      ['off', 62, 0],
    ]);
  });

  it('keeps a held-set identity while nothing changes', () => {
    const { device } = setup();
    device.press(60);
    const before = hub.store.getState().held;
    device.press(60);
    device.release(61);
    expect(hub.store.getState().held).toBe(before);
  });

  it('hears the keyboard fallback only while no device is connected', () => {
    hub = createMidiHub();
    const device = new FakeMidiInput({ kind: 'no-device' });
    const keyboard = new FakeMidiInput();
    hub.attach(device, 'device');
    hub.attach(keyboard, 'fallback');
    const listener = vi.fn();
    hub.subscribeEvents(listener);

    keyboard.press(60);
    expect([...hub.store.getState().held]).toEqual([60]);
    expect(hub.store.getState().keyboardActive).toBe(true);

    device.connect('Roland FP-30X', 'fp30x');
    expect([...hub.store.getState().held]).toEqual([]);
    expect(hub.store.getState().keyboardActive).toBe(false);
    keyboard.press(62);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keyboardAlways (dev) hears the fallback alongside a device', () => {
    hub = createMidiHub({ keyboardAlways: true });
    const device = new FakeMidiInput();
    const keyboard = new FakeMidiInput();
    hub.attach(device, 'device');
    hub.attach(keyboard, 'fallback');
    device.press(48);
    keyboard.press(60);
    expect([...hub.store.getState().held].sort((a, b) => a - b)).toEqual([48, 60]);
  });

  it('dev inputs are always heard and merge with the device', () => {
    hub = createMidiHub();
    const device = new FakeMidiInput();
    const dev = new FakeMidiInput();
    hub.attach(device, 'device');
    hub.attach(dev, 'dev');
    device.press(57);
    dev.press(61);
    expect([...hub.store.getState().held].sort((a, b) => a - b)).toEqual([57, 61]);
  });
});
