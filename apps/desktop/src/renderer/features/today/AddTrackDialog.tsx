import { useEffect, useId, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { TextButton } from '../../components/ui/TextButton';
import type { TrackSummary } from './today';
import styles from './AddTrackDialog.module.css';

export interface AddTrackDialogProps {
  /** Available tracks that are not active yet (see `addableTracks`). */
  tracks: readonly TrackSummary[];
  onPick: (trackId: string) => void;
  onClose: () => void;
  /** The track currently being enrolled (disables the list). */
  busyId?: string | null;
}

/**
 * "Add something to learn" (Main:162) — not in the designs. A modal built from Card (Main:51)
 * and track rows styled like Main:156; picking one enrolls it via `tracks.setSettings`.
 */
export function AddTrackDialog({ tracks, onPick, onClose, busyId = null }: AddTrackDialogProps) {
  const titleId = useId();
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.dialog}
        data-testid="add-track-dialog"
      >
        <Card>
          <h2 id={titleId} className={styles.title}>
            Add something to learn
          </h2>
          {tracks.length === 0 ? (
            <p className={styles.lede}>
              You&apos;re already learning everything that&apos;s ready. More tracks are on the way.
            </p>
          ) : (
            <>
              <p className={styles.lede}>It joins your daily plan from tomorrow.</p>
              <div className={styles.list}>
                {tracks.map((t, i) => (
                  <button
                    key={t.id}
                    ref={i === 0 ? firstRef : undefined}
                    type="button"
                    className={styles.option}
                    disabled={busyId !== null}
                    onClick={() => onPick(t.id)}
                    data-testid={`add-track-${t.id}`}
                  >
                    <span>{t.title}</span>
                    <span className={styles.optionCta}>
                      {busyId === t.id ? 'Adding…' : 'Start learning'}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className={styles.actions}>
            <TextButton onClick={onClose}>Not now</TextButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
