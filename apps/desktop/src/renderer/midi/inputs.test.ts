import { describe, expect, it } from 'vitest';
import { KeyboardMidiInput } from './KeyboardMidiInput';
import { WebMidiInput } from './WebMidiInput';

function press(key: string, type: 'keydown' | 'keyup', init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent(type, { key, ...init }));
}

describe('KeyboardMidiInput (docs/ui.md §4)', () => {
  it('a d g play C4 E4 G4; release on keyup', async () => {
    const kb = new KeyboardMidiInput(window);
    await kb.start();
    press('a', 'keydown');
    press('d', 'keydown');
    press('g', 'keydown');
    expect([...kb.held$.get()]).toEqual([60, 64, 67]);
    press('d', 'keyup');
    expect([...kb.held$.get()]).toEqual([60, 67]);
    kb.stop();
    expect(kb.held$.get().size).toBe(0);
  });

  it('maps ; to E5 and shifts octaves with z / x', async () => {
    const kb = new KeyboardMidiInput(window);
    await kb.start();
    press(';', 'keydown');
    expect([...kb.held$.get()]).toEqual([76]);
    press(';', 'keyup');
    press('z', 'keydown');
    press('a', 'keydown');
    expect([...kb.held$.get()]).toEqual([48]);
    // Shifting while held still releases the original pitch.
    press('x', 'keydown');
    press('a', 'keyup');
    expect(kb.held$.get().size).toBe(0);
    kb.stop();
  });

  it('ignores auto-repeat and modifier chords', async () => {
    const kb = new KeyboardMidiInput(window);
    await kb.start();
    press('s', 'keydown', { ctrlKey: true });
    expect(kb.held$.get().size).toBe(0);
    let ons = 0;
    kb.events$.subscribe((e) => {
      if (e.type === 'on') ons++;
    });
    press('s', 'keydown');
    press('s', 'keydown', { repeat: true });
    expect(ons).toBe(1);
    kb.stop();
  });

  it('releases everything on window blur', async () => {
    const kb = new KeyboardMidiInput(window);
    await kb.start();
    press('a', 'keydown');
    window.dispatchEvent(new Event('blur'));
    expect(kb.held$.get().size).toBe(0);
    kb.stop();
  });
});

describe('WebMidiInput status', () => {
  it('reports unsupported without Web MIDI', async () => {
    const input = new WebMidiInput(undefined);
    await input.start();
    expect(input.status$.get()).toEqual({ kind: 'unsupported' });
  });

  it('reports denied on SecurityError', async () => {
    const input = new WebMidiInput({
      requestMIDIAccess: () => Promise.reject(new DOMException('no', 'SecurityError')),
    });
    await input.start();
    expect(input.status$.get()).toEqual({ kind: 'denied' });
  });

  it('reports no-device, then connected on hot-plug, and parses note bytes', async () => {
    type Handler = ((e: { data: Uint8Array }) => void) | null;
    const device = {
      id: 'fp30x',
      name: 'Roland FP-30X',
      state: 'disconnected',
      onmidimessage: null as Handler,
    };
    const inputs = new Map<string, typeof device>([['fp30x', device]]);
    const access = { inputs, onstatechange: null as (() => void) | null };
    const input = new WebMidiInput({
      requestMIDIAccess: () => Promise.resolve(access as unknown as MIDIAccess),
    });
    await input.start();
    expect(input.status$.get()).toEqual({ kind: 'no-device' });

    device.state = 'connected';
    access.onstatechange?.();
    expect(input.status$.get()).toEqual({
      kind: 'connected',
      deviceName: 'Roland FP-30X',
      deviceId: 'fp30x',
    });

    device.onmidimessage?.({ data: new Uint8Array([0x90, 60, 100]) });
    device.onmidimessage?.({ data: new Uint8Array([0x91, 64, 80]) });
    device.onmidimessage?.({ data: new Uint8Array([0xb0, 64, 127]) });
    expect([...input.held$.get()]).toEqual([60, 64]);
    // decisions.md 2026-10-13: CC64 is the sustain pedal (down at ≥ 64); other CCs are ignored.
    expect(input.sustain$.get()).toBe(true);
    device.onmidimessage?.({ data: new Uint8Array([0xb0, 1, 0]) });
    expect(input.sustain$.get()).toBe(true);
    device.onmidimessage?.({ data: new Uint8Array([0x90, 60, 0]) });
    expect([...input.held$.get()]).toEqual([64]);

    device.state = 'disconnected';
    access.onstatechange?.();
    expect(input.held$.get().size).toBe(0);
    expect(input.sustain$.get()).toBe(false);
    expect(input.status$.get()).toEqual({ kind: 'no-device' });
    input.stop();
  });
});
