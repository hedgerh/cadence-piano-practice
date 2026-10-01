import {
  BaseMidiInput,
  type MidiDeviceInfo,
  type MidiDevicePreference,
  type SelectableMidiInput,
} from './MidiInput';
import { writable, type Readable } from './signal';

const FALLBACK_NAME = 'MIDI keyboard';

/**
 * Real MIDI devices via Web MIDI (docs/ui.md §4): `requestMIDIAccess({ sysex: false })`;
 * `0x90` with velocity > 0 is note-on, `0x80` or velocity 0 is note-off; sustain (CC64)
 * and everything else is ignored.
 *
 * Task 16: listens to ONE input — the learner's preferred port (by id, then by name) when it is
 * connected, otherwise the first connected one — and lists every connected port in `devices$`
 * for the MidiPill's picker. Hot-plug via `onstatechange`: whenever the active port changes or
 * disappears, held notes are released so nothing stays lit.
 */
export class WebMidiInput extends BaseMidiInput implements SelectableMidiInput {
  private access: MIDIAccess | null = null;
  private active: MIDIInput | null = null;
  private preference: MidiDevicePreference | null;
  private stopped = false;
  private readonly devices = writable<readonly MidiDeviceInfo[]>([]);

  constructor(
    private readonly nav: Pick<Navigator, 'requestMIDIAccess'> | undefined = globalThis.navigator,
    opts: { preference?: MidiDevicePreference | null } = {},
  ) {
    super();
    this.preference = opts.preference ?? null;
  }

  get devices$(): Readable<readonly MidiDeviceInfo[]> {
    return this.devices;
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
    this.bind(null);
    if (this.access) this.access.onstatechange = null;
    this.access = null;
    this.devices.set([]);
  }

  select(preference: MidiDevicePreference | null): void {
    this.preference = preference;
    this.sync();
  }

  /** Recompute the connected ports, pick the active one and the status. */
  private sync(): void {
    const access = this.access;
    if (!access) return;
    const connected: MIDIInput[] = [];
    access.inputs.forEach((input) => {
      if (input.state === 'connected') connected.push(input);
    });

    const list = connected.map((i) => ({ id: i.id, name: i.name ?? FALLBACK_NAME }));
    const prev = this.devices.get();
    const same =
      prev.length === list.length &&
      prev.every((d, k) => d.id === list[k]?.id && d.name === list[k]?.name);
    if (!same) this.devices.set(list);

    const pref = this.preference;
    const chosen =
      (pref?.id != null ? connected.find((i) => i.id === pref.id) : undefined) ??
      (pref?.name != null ? connected.find((i) => i.name === pref.name) : undefined) ??
      connected[0] ??
      null;
    this.bind(chosen);

    if (chosen) {
      this.status.set({
        kind: 'connected',
        deviceName: chosen.name ?? FALLBACK_NAME,
        deviceId: chosen.id,
      });
    } else {
      this.status.set({ kind: 'no-device' });
    }
  }

  /** Listen to `input` only; switching or losing the port releases every held note. */
  private bind(input: MIDIInput | null): void {
    if (this.active === input) return;
    if (this.active) this.active.onmidimessage = null;
    this.releaseAll();
    this.active = input;
    if (input) input.onmidimessage = (e) => this.handle(e);
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
