// decisions.md 2026-10-21 "Songs from MIDI": reading Standard MIDI Files and turning them into a
// two-hand song. Files are built byte by byte here.
import { describe, expect, it } from 'vitest';
import { MidiParseError, parseMidi } from './midiFile';
import { barLines, songFromMidi } from './song';

const vlq = (n: number): number[] => {
  const out = [n & 0x7f];
  let v = n >> 7;
  while (v > 0) {
    out.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return out;
};
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const chunk = (tag: string, body: number[]) => [
  ...[...tag].map((c) => c.charCodeAt(0)),
  ...u32(body.length),
  ...body,
];

/** A track from `[delta, ...eventBytes]` rows, ending with end-of-track. */
const track = (rows: (readonly number[])[]) =>
  chunk('MTrk', [
    ...rows.flatMap(([delta = 0, ...ev]) => [...vlq(delta), ...ev]),
    0,
    0xff,
    0x2f,
    0,
  ]);

function file(format: number, ppq: number, tracks: number[][]): Uint8Array {
  const header = chunk('MThd', [0, format, 0, tracks.length, (ppq >> 8) & 255, ppq & 255]);
  return new Uint8Array([...header, ...tracks.flat()]);
}

const PPQ = 480;
const conductor = track([
  [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20], // 500000 µs = 120 BPM
  [0, 0xff, 0x58, 4, 4, 2, 24, 8], // 4/4
  [PPQ * 4, 0xff, 0x58, 4, 2, 2, 24, 8], // bar 2: 2/4
  [PPQ * 2, 0xff, 0x58, 4, 4, 2, 24, 8], // bar 3: 4/4
]);
const right = track([
  [0, 0xff, 0x03, 2, 82, 72], // name "RH"
  [0, 0x90, 64, 80], // E4 on
  [0, 67, 70], // running status: G4 on
  [0, 0xb0, 64, 127], // pedal down
  [PPQ, 0x80, 64, 0], // E4 off
  [0, 0x90, 67, 0], // G4 off (note-on, velocity 0)
  [0, 0xb0, 64, 0], // pedal up
  [0, 0x90, 72, 90], // C5
  [PPQ * 2, 0x80, 72, 0],
]);
const left = track([
  [0, 0x90, 36, 60], // C2
  [PPQ * 2, 0x80, 36, 0],
  [PPQ * 4, 0x90, 62, 55], // D4: the left hand above middle C is still the left hand
  [PPQ, 0x80, 62, 0],
]);

describe('parseMidi', () => {
  it('reads tempo, meters, names, notes (running status, velocity-0 offs) and the pedal', () => {
    const midi = parseMidi(file(1, PPQ, [conductor, right, left]));
    expect(midi).toMatchObject({ format: 1, ppq: PPQ });
    expect(midi.tempos).toEqual([{ tick: 0, bpm: 120 }]);
    expect(midi.meters.map((m) => `${m.num}/${m.den}`)).toEqual(['4/4', '2/4', '4/4']);
    const rh = midi.tracks[1];
    expect(rh?.name).toBe('RH');
    expect(rh?.notes.map((n) => [n.tick, n.dur, n.midi, n.velocity])).toEqual([
      [0, PPQ, 64, 80],
      [0, PPQ, 67, 70],
      [PPQ, PPQ * 2, 72, 90],
    ]);
    expect(rh?.pedal).toEqual([
      { tick: 0, down: true },
      { tick: PPQ, down: false },
    ]);
  });

  it('format 0: each channel becomes its own part', () => {
    const one = track([
      [0, 0x90, 72, 80],
      [0, 0x91, 40, 80],
      [PPQ, 0x80, 72, 0],
      [0, 0x81, 40, 0],
    ]);
    const midi = parseMidi(file(0, PPQ, [one]));
    expect(midi.tracks.map((t) => t.notes.map((n) => n.midi))).toEqual([[72], [40]]);
  });

  it('refuses what is not a MIDI file', () => {
    expect(() => parseMidi(new TextEncoder().encode('hello, not a midi file'))).toThrow(
      MidiParseError,
    );
    expect(() => parseMidi(file(1, PPQ, [[0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 9, 0, 0x90]]))).toThrow(
      MidiParseError,
    );
  });
});

describe('songFromMidi', () => {
  it('beats, hands by part (not by pitch), bars across a 2/4 bar, the pedal', () => {
    const song = songFromMidi(parseMidi(file(1, PPQ, [conductor, right, left])), 'Test');
    expect(song.right.map((n) => [n.beat, n.dur, n.midi])).toEqual([
      [0, 1, 64],
      [0, 1, 67],
      [1, 2, 72],
    ]);
    expect(song.left.map((n) => [n.beat, n.midi])).toEqual([
      [0, 36],
      [6, 62],
    ]);
    expect(song.bars.map((b) => [b.number, b.beat, b.beats])).toEqual([
      [1, 0, 4],
      [2, 4, 2],
      [3, 6, 4],
    ]);
    expect(song.tempos).toEqual([{ beat: 0, bpm: 120 }]);
    expect(song.pedal).toEqual([
      { beat: 0, down: true },
      { beat: 1, down: false },
    ]);
    expect(song.lengthBeats).toBe(7);
  });

  it('one part splits at middle C; no notes is an error', () => {
    const one = track([
      [0, 0x90, 72, 80],
      [0, 0x90, 48, 80],
      [PPQ, 0x80, 72, 0],
      [0, 0x80, 48, 0],
    ]);
    const song = songFromMidi(parseMidi(file(1, PPQ, [one])), 'One');
    expect(song.right.map((n) => n.midi)).toEqual([72]);
    expect(song.left.map((n) => n.midi)).toEqual([48]);
    expect(() => songFromMidi(parseMidi(file(1, PPQ, [conductor])), 'Empty')).toThrow(RangeError);
  });

  it('a file with no meter is 4/4 throughout', () => {
    expect(barLines({ meters: [], ppq: PPQ }, 9).map((b) => b.beat)).toEqual([0, 4, 8]);
  });
});
