// Imported songs (decisions.md 2026-10-21 "Songs from MIDI"): each MIDI file the learner imports
// is read once (`parseMidi` + `songFromMidi`) and saved as JSON in userData/songs/<id>.json.
// The learner's own files stay on their computer; nothing is bundled with the app.
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MidiParseError, parseMidi, songFromMidi } from '@cadence/music';
import { SongSchema, type ChannelInput, type ChannelOutput } from '../shared/ipc/contracts';

export type SavedSong = ChannelOutput<'songs.get'>;
export type SongSummary = ChannelOutput<'songs.list'>[number];

export interface SongStore {
  list(): SongSummary[];
  get(songId: string): SavedSong;
  import(input: ChannelInput<'songs.import'>): SongSummary;
  delete(songId: string): void;
}

/** "Fred again.. - Delilah (pull me out of this).mid" → "Fred again.. - Delilah (pull me out of this)". */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, '').replace(/\.(mid|midi|smf)$/i, '');
  return base.trim() || 'Untitled song';
}

/** A file-safe id: the title's letters and digits, plus a short random suffix. */
export function songId(title: string, random: string = randomUUID()): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'song'}-${random
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toLowerCase()}`;
}

export function summarize(song: SavedSong): SongSummary {
  return {
    id: song.id,
    title: song.title,
    fileName: song.fileName,
    importedAt: song.importedAt,
    bars: song.bars.length,
    notes: song.left.length + song.right.length,
    bpm: Math.round(song.tempos[0]?.bpm ?? 120),
  };
}

export function createSongStore(dir: string, now: () => number = Date.now): SongStore {
  const path = (id: string) => join(dir, `${id}.json`);
  const read = (file: string): SavedSong | null => {
    try {
      return SongSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      return null; // unreadable or from an older shape: left out of the list
    }
  };

  return {
    list() {
      let files: string[];
      try {
        files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      } catch {
        return [];
      }
      return files
        .map((f) => read(join(dir, f)))
        .filter((s): s is SavedSong => s !== null)
        .map(summarize)
        .sort((a, b) => b.importedAt - a.importedAt);
    },

    get(id) {
      const song = read(path(id));
      if (!song) throw new Error(`Song "${id}" was not found`);
      return song;
    },

    import({ fileName, title, data }) {
      const bytes = Buffer.from(data, 'base64');
      let midi;
      try {
        midi = parseMidi(new Uint8Array(bytes));
      } catch (err) {
        throw new Error(
          err instanceof MidiParseError
            ? `That file isn't a MIDI file Cadence can read (${err.message}).`
            : 'That file could not be read.',
        );
      }
      const name = title?.trim() || titleFromFileName(fileName);
      let parsed;
      try {
        parsed = songFromMidi(midi, name);
      } catch (err) {
        throw new Error(
          err instanceof Error ? `That MIDI file can't be used: ${err.message}.` : String(err),
        );
      }
      const song: SavedSong = SongSchema.parse({
        ...parsed,
        id: songId(name),
        fileName: fileName.replace(/^.*[\\/]/, ''),
        importedAt: now(),
      });
      mkdirSync(dir, { recursive: true });
      writeFileSync(path(song.id), JSON.stringify(song));
      return summarize(song);
    },

    delete(id) {
      rmSync(path(id), { force: true });
    },
  };
}
