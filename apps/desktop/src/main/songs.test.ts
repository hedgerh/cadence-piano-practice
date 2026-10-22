import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSongStore, songId, titleFromFileName } from './songs';

// decisions.md 2026-10-21 "Songs from MIDI": imported files are read once and saved as JSON in
// userData/songs; a broken file is refused with a readable message.

/** A two-part MIDI file: right hand E4+G4 on beat 1, left hand C2. */
function twoHandMidi(): string {
  const bytes = [
    ...[0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 2, 0x01, 0xe0],
    ...[0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 21],
    ...[
      0, 0x90, 64, 80, 0, 0x90, 67, 80, 0x83, 0x60, 0x80, 64, 0, 0, 0x80, 67, 0, 0, 0xff, 0x2f, 0,
    ],
    ...[0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 13],
    ...[0, 0x90, 36, 70, 0x83, 0x60, 0x80, 36, 0, 0, 0xff, 0x2f, 0],
  ];
  return Buffer.from(bytes).toString('base64');
}

describe('song store', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cadence-songs-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('imports a MIDI file, lists it newest first, reads it back and deletes it', () => {
    let t = 1000;
    const store = createSongStore(join(dir, 'songs'), () => t++);
    expect(store.list()).toEqual([]);
    const a = store.import({ fileName: 'C:\\music\\Delilah.mid', data: twoHandMidi() });
    expect(a).toMatchObject({
      title: 'Delilah',
      fileName: 'Delilah.mid',
      bars: 1,
      notes: 3,
      bpm: 120,
    });
    const b = store.import({ fileName: 'other.midi', title: 'My take', data: twoHandMidi() });
    expect(store.list().map((s) => s.title)).toEqual(['My take', 'Delilah']);
    const song = store.get(a.id);
    expect(song.right.map((n) => n.midi)).toEqual([64, 67]);
    expect(song.left.map((n) => [n.beat, n.dur, n.midi])).toEqual([[0, 1, 36]]);
    store.delete(b.id);
    expect(store.list().map((s) => s.id)).toEqual([a.id]);
    expect(() => store.get(b.id)).toThrow(/not found/);
  });

  it('refuses files that are not MIDI, and skips unreadable saved files', () => {
    const store = createSongStore(dir);
    expect(() =>
      store.import({ fileName: 'notes.txt', data: Buffer.from('hello').toString('base64') }),
    ).toThrow(/isn't a MIDI file/);
    writeFileSync(join(dir, 'broken.json'), '{ nope');
    expect(store.list()).toEqual([]);
  });

  it('ids are file-safe; titles come from the file name', () => {
    expect(songId('Fred again.. – Delilah (pull me out of this)', 'AB12-cd34-ef')).toBe(
      'fred-again-delilah-pull-me-out-of-this-ab12cd34',
    );
    expect(titleFromFileName('/x/y/Song Name.MID')).toBe('Song Name');
    expect(titleFromFileName('.mid')).toBe('Untitled song');
  });
});
