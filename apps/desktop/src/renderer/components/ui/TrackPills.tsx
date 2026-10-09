import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import { ArrowLeftIcon } from './icons';
import styles from './TrackPills.module.css';

export interface TrackPill {
  id: string;
  label: string;
  state: 'active' | 'available' | 'locked';
  /** Where an active/available pill links to. */
  to: string;
}

/**
 * Path:41–47 — the track switcher. Locked tracks are plain spans. With `allTracksTo`, a muted
 * "All tracks" back link (TaskHeader's back style) leads the row and the pills hold only the
 * current track's group (decisions.md 2026-10-08 "Track library").
 */
export function TrackPills({
  pills,
  allTracksTo,
}: {
  pills: readonly TrackPill[];
  allTracksTo?: string;
}) {
  return (
    <div className={styles.pills} data-testid="track-pills">
      {allTracksTo !== undefined && (
        <Link to={allTracksTo} className={styles.all} data-testid="all-tracks-link">
          <ArrowLeftIcon />
          <span>All tracks</span>
        </Link>
      )}
      {pills.map((p) =>
        p.state === 'locked' ? (
          <span key={p.id} className={cx(styles.pill, styles.locked)} data-state="locked">
            {p.label}
          </span>
        ) : (
          <Link
            key={p.id}
            to={p.to}
            className={cx(styles.pill, styles[p.state])}
            data-state={p.state}
            aria-current={p.state === 'active' ? 'page' : undefined}
          >
            {p.label}
          </Link>
        ),
      )}
    </div>
  );
}
