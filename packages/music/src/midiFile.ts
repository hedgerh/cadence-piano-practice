// Standard MIDI File reader (decisions.md 2026-10-21 "Songs from MIDI"): formats 0 and 1,
// running status, meta and sysex events. Pure — bytes in, notes out — so main (import) and tests
// share it. Only what Cadence plays is kept: notes, the sustain pedal, tempo and meter.
import type { Midi } from './pitch';

export interface MidiNote {
  /** Start, in ticks from the beginning. */
  tick: number;
  /** Length in ticks (note-on to its note-off). */
  dur: number;
  midi: Midi;
  velocity: number;
  channel: number;
}

export interface MidiPedal {
  tick: number;
  down: boolean;
}

export interface MidiTrack {
  /** Track name meta event, if any. */
  name: string;
  notes: MidiNote[];
  pedal: MidiPedal[];
}

export interface MidiFile {
  format: number;
  /** Ticks per quarter note. */
  ppq: number;
  tracks: MidiTrack[];
  /** Tempo changes (beats per minute), sorted; a file without one plays at 120. */
  tempos: { tick: number; bpm: number }[];
  /** Time signatures, sorted; a file without one is 4/4. */
  meters: { tick: number; num: number; den: number }[];
  /** The last event's tick. */
  endTick: number;
}

export class MidiParseError extends Error {}

const SUSTAIN = 64;

class Reader {
  pos = 0;
  constructor(private readonly b: Uint8Array) {}
  get done(): boolean {
    return this.pos >= this.b.length;
  }
  byte(): number {
    const v = this.b[this.pos];
    if (v === undefined) throw new MidiParseError('unexpected end of file');
    this.pos += 1;
    return v;
  }
  peek(): number {
    const v = this.b[this.pos];
    if (v === undefined) throw new MidiParseError('unexpected end of file');
    return v;
  }
  u16(): number {
    return (this.byte() << 8) | this.byte();
  }
  u32(): number {
    return ((this.byte() << 24) >>> 0) + (this.byte() << 16) + (this.byte() << 8) + this.byte();
  }
  vlq(): number {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const c = this.byte();
      v = (v << 7) | (c & 0x7f);
      if ((c & 0x80) === 0) return v;
    }
    throw new MidiParseError('variable-length number too long');
  }
  bytes(n: number): Uint8Array {
    if (this.pos + n > this.b.length) throw new MidiParseError('unexpected end of file');
    const out = this.b.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
  tag(): string {
    return String.fromCharCode(...this.bytes(4));
  }
}

/** Read a Standard MIDI File. Throws `MidiParseError` for anything that isn't one. */
export function parseMidi(bytes: Uint8Array): MidiFile {
  const r = new Reader(bytes);
  if (bytes.length < 14 || r.tag() !== 'MThd') throw new MidiParseError('not a MIDI file');
  const headerLength = r.u32();
  const format = r.u16();
  const trackCount = r.u16();
  const division = r.u16();
  if (division & 0x8000) throw new MidiParseError('SMPTE timing is not supported');
  if (format > 2) throw new MidiParseError(`unknown MIDI format ${format}`);
  r.pos = 8 + headerLength;
  const tracks: MidiTrack[] = [];
  const tempos: MidiFile['tempos'] = [];
  const meters: MidiFile['meters'] = [];
  let endTick = 0;

  for (let t = 0; t < trackCount && !r.done; t++) {
    const tag = r.tag();
    const length = r.u32();
    const end = r.pos + length;
    if (tag !== 'MTrk') {
      r.pos = end; // an unknown chunk: skip it
      continue;
    }
    let tick = 0;
    let status = 0;
    let name = '';
    const notes: MidiNote[] = [];
    const pedal: MidiPedal[] = [];
    const open = new Map<string, { tick: number; velocity: number }[]>();
    const close = (channel: number, midi: number, at: number) => {
      const stack = open.get(`${channel}:${midi}`);
      const on = stack?.shift();
      if (on)
        notes.push({
          tick: on.tick,
          dur: Math.max(1, at - on.tick),
          midi,
          velocity: on.velocity,
          channel,
        });
    };
    while (r.pos < end) {
      tick += r.vlq();
      let b = r.peek();
      if (b === 0xff) {
        r.pos += 1;
        const type = r.byte();
        const data = r.bytes(r.vlq());
        if (type === 0x51 && data.length === 3) {
          const us = ((data[0] ?? 0) << 16) | ((data[1] ?? 0) << 8) | (data[2] ?? 0);
          if (us > 0) tempos.push({ tick, bpm: 60_000_000 / us });
        } else if (type === 0x58 && data.length >= 2) {
          meters.push({ tick, num: data[0] ?? 4, den: 2 ** (data[1] ?? 2) });
        } else if (type === 0x03 && name === '') {
          name = String.fromCharCode(...data).trim();
        }
        continue;
      }
      if (b === 0xf0 || b === 0xf7) {
        r.pos += 1;
        r.bytes(r.vlq());
        continue;
      }
      if (b & 0x80) {
        status = b;
        r.pos += 1;
      } else if (status === 0) {
        throw new MidiParseError('data byte without a status');
      }
      b = status;
      const kind = b & 0xf0;
      const channel = b & 0x0f;
      if (kind === 0xc0 || kind === 0xd0) {
        r.byte();
        continue;
      }
      const a = r.byte();
      const v = r.byte();
      if (kind === 0x90 && v > 0) {
        const key = `${channel}:${a}`;
        const stack = open.get(key) ?? [];
        stack.push({ tick, velocity: v });
        open.set(key, stack);
      } else if (kind === 0x80 || kind === 0x90) {
        close(channel, a, tick);
      } else if (kind === 0xb0 && a === SUSTAIN) {
        const down = v >= 64;
        if (pedal.at(-1)?.down !== down) pedal.push({ tick, down });
      }
    }
    r.pos = end;
    // Notes never released end with the track.
    for (const [key, stack] of open) {
      const [channel, midi] = key.split(':').map(Number);
      for (const on of stack) {
        notes.push({
          tick: on.tick,
          dur: Math.max(1, tick - on.tick),
          midi: midi ?? 0,
          velocity: on.velocity,
          channel: channel ?? 0,
        });
      }
    }
    endTick = Math.max(endTick, tick);
    notes.sort((x, y) => x.tick - y.tick || x.midi - y.midi);
    tracks.push({ name, notes, pedal });
  }

  const byTick = <T extends { tick: number }>(xs: T[]) => xs.sort((x, y) => x.tick - y.tick);
  return {
    format,
    ppq: division,
    tracks: format === 0 ? splitChannels(tracks) : tracks,
    tempos: byTick(tempos),
    meters: byTick(meters),
    endTick,
  };
}

/** Format 0 keeps every part in one track: give each channel its own. */
function splitChannels(tracks: MidiTrack[]): MidiTrack[] {
  const out: MidiTrack[] = [];
  for (const t of tracks) {
    const channels = [...new Set(t.notes.map((n) => n.channel))].sort((a, b) => a - b);
    if (channels.length <= 1) {
      out.push(t);
      continue;
    }
    for (const ch of channels) {
      out.push({
        name: `${t.name} ${ch + 1}`.trim(),
        notes: t.notes.filter((n) => n.channel === ch),
        pedal: t.pedal,
      });
    }
  }
  return out;
}
