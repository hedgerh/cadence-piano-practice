// `/jam/songs` (decisions.md 2026-10-21 "Songs from MIDI"): the songs the learner has imported,
// and the Import MIDI button. A file is read in main and kept in userData; nothing leaves the
// computer.
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { AppHeader } from '../../components/ui/AppHeader';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextButton } from '../../components/ui/TextButton';
import { JamTabs } from '../jam/JamTabs';
import { useDeleteSong, useImportSong, useMe, useSongs } from '../shared/hooks';
import styles from './songs.module.css';

/** A file's bytes as base64, for the import channel. */
export async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** "Error invoking remote method 'songs.import': Error: That file isn't…" → "That file isn't…". */
export function importErrorText(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const text = raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '');
  return text || 'That file could not be imported.';
}

export function SongsPage() {
  const me = useMe();
  const songs = useSongs();
  const importSong = useImportSong();
  const deleteSong = useDeleteSong();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      await importSong.mutateAsync({ fileName: file.name, data: await fileToBase64(file) });
    } catch (err) {
      setError(importErrorText(err));
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const list = songs.data ?? [];
  return (
    <div className={styles.page} data-testid="songs">
      <AppHeader
        active="jam"
        streakDays={me.data?.streak.days ?? 0}
        xp={me.data?.xpTotal ?? 0}
        showMidi
      />
      <main className={styles.main}>
        <JamTabs active="songs" />
        <div className={styles.intro}>
          <h1 className={styles.title}>Your songs</h1>
          <p className={styles.lede}>
            Import a MIDI file of a piano part and learn it exactly as written: each hand, every
            inversion, every octave. Then play along with it in time.
          </p>
        </div>

        <div className={styles.importRow}>
          <PrimaryButton
            onClick={() => input.current?.click()}
            disabled={importSong.isPending}
            data-testid="song-import"
          >
            {importSong.isPending ? 'Importing…' : 'Import MIDI'}
          </PrimaryButton>
          <input
            ref={input}
            type="file"
            accept=".mid,.midi,audio/midi,audio/x-midi"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
            data-testid="song-file"
          />
          <span className={styles.hint}>
            Two tracks (right hand, left hand) work best. From Ableton: right-click a clip and
            Export MIDI Clip. From MuseScore: File → Export → MIDI.
          </span>
        </div>
        {error !== null && (
          <p className={styles.error} role="alert" data-testid="song-import-error">
            {error}
          </p>
        )}

        {songs.isSuccess && list.length === 0 && (
          <p className={styles.empty} data-testid="songs-empty">
            No songs yet. Import a MIDI file to start.
          </p>
        )}
        <ul className={styles.list} data-testid="songs-list">
          {list.map((s) => (
            <li key={s.id} className={styles.song} data-testid={`song-${s.id}`}>
              <Link to={`/jam/songs/${s.id}`} className={styles.songTitle}>
                {s.title}
              </Link>
              <span className={styles.songMeta}>
                {s.bars} bars · {s.bpm} BPM · {s.notes} notes
              </span>
              {confirming === s.id ? (
                <>
                  <TextButton
                    onClick={() => {
                      setConfirming(null);
                      deleteSong.mutate(s.id);
                    }}
                    data-testid={`song-delete-confirm-${s.id}`}
                  >
                    Remove for good
                  </TextButton>
                  <TextButton onClick={() => setConfirming(null)}>Keep</TextButton>
                </>
              ) : (
                <TextButton onClick={() => setConfirming(s.id)} data-testid={`song-delete-${s.id}`}>
                  Remove
                </TextButton>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
