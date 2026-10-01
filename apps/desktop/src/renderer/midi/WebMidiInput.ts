import { BaseMidiInput } from './MidiInput';

/**
 * Real MIDI devices via Web MIDI (docs/ui.md §4): `requestMIDIAccess({ sysex: false })`;
 * `0x90` with velocity > 0 is note-on, `0x80` or velocity 0 is note-off; sustain (CC64)
 * and everything else is ignored. Hot-plug via `onstatechange`; held notes clear when
 * the last device disconnects. The pill shows the first input's name.
 */
export class WebMidiInput extends BaseMidiInput {
  private access: MIDIAccess | null = null;
  private readonly bound = new Map<string, MIDIInput>();
  private stopped = false;

  constructor(
    private readonly nav: Pick<Navigator, 'requestMIDIAccess'> | undefined = globalThis.navigator,
  ) {
    super();
  }

  async start(): Promise<void> {
    this.stopped = false;
    if (!this.nav || typeof this.nav.requestMIDIAccess !== 'function') {
      this.status.set({ kind: 'unsupported' });
      return;
    }
    this.status.set({ kind: 'requesting' });
    try {
      const access = await this.nav.requestMIDIAccess({ sysex: false });
      if (this.stopped) return;
      this.access = access;
      access.onstatechange = () => this.sync();
      this.sync();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      this.status.set(
        name === 'SecurityError' || name === 'NotAllowedError'
          ? { kind: 'denied' }
          : { kind: 'unsupported' },
      );
    }
  }

  stop(): void {
    this.stopped = true;
    for (const input of this.bound.values()) input.onmidimessage = null;
    this.bound.clear();
    if (this.access) this.access.onstatechange = null;
    this.access = null;
    this.releaseAll();
  }

  /** Re-bind to every connected input and recompute the status. */
  private sync(): void {
    const access = this.access;
    if (!access) return;
    const connected: MIDIInput[] = [];
    access.inputs.forEach((input) => {
      if (input.state === 'connected') connected.push(input);
    });

    for (const [id, input] of this.bound) {
      if (!connected.some((c) => c.id === id)) {
        input.onmidimessage = null;
        this.bound.delete(id);
      }
    }
    for (const input of connected) {
      if (this.bound.has(input.id)) continue;
      input.onmidimessage = (e) => this.handle(e);
      this.bound.set(input.id, input);
    }

    const first = connected[0];
    if (first) {
      this.status.set({
        kind: 'connected',
        deviceName: first.name ?? 'MIDI keyboard',
        deviceId: first.id,
      });
    } else {
      this.releaseAll();
      this.status.set({ kind: 'no-device' });
    }
  }

  private handle(e: MIDIMessageEvent): void {
    const data = e.data;
    if (!data || data.length < 3) return;
    const status = data[0] ?? 0;
    const note = data[1] ?? 0;
    const velocity = data[2] ?? 0;
    const kind = status & 0xf0;
    if (kind === 0x90) this.noteOn(note, velocity);
    else if (kind === 0x80) this.noteOff(note);
  }
}
