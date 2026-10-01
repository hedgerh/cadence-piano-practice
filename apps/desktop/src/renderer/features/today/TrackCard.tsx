import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { cx } from '../../lib/cx';
import type { TrackCardDto } from './today';
import styles from './TrackCard.module.css';

const trackRoute = (trackId: string) => `/tracks/${trackId}`;

/**
 * Main:119–145 — the full track card: title + status, progress bar, progress / next line.
 * In-progress tracks get the tangerine border and bar (Main:119, 125); others teal (Main:139).
 */
export function TrackCard({ track }: { track: TrackCardDto }) {
  const inProgress = track.status === 'in_progress';
  const value = track.total > 0 ? track.done / track.total : 0;
  return (
    <Card
      variant="track"
      active={inProgress}
      to={trackRoute(track.trackId)}
      data-testid={`track-card-${track.trackId}`}
    >
      <div className={styles.head}>
        <span className={styles.title}>{track.title}</span>
        <span className={cx(styles.status, inProgress ? styles.statusWarm : styles.statusCool)}>
          {track.statusLabel}
        </span>
      </div>
      <ProgressBar
        value={value}
        tone={inProgress ? 'tangerine' : 'teal'}
        aria-label={`${track.title} progress`}
      />
      <div className={styles.foot}>
        <span>{track.progressText}</span>
        {track.nextText !== null && <span>{track.nextText}</span>}
      </div>
    </Card>
  );
}

/**
 * Main:148–159 — compact rows. Unavailable tracks are muted, non-interactive rows (Main:148–155);
 * an available ladder track links to its path with the current level in lavender (Main:156–158).
 */
export function TrackRow({ track }: { track: TrackCardDto }) {
  if (!track.available) {
    return (
      <Card variant="row" data-testid={`track-row-${track.trackId}`}>
        <span className={cx(styles.rowTitle, styles.rowTitleMuted)}>{track.title}</span>
        <span className={styles.rowStatus}>{track.statusLabel}</span>
      </Card>
    );
  }
  return (
    <Card
      variant="row"
      active
      to={trackRoute(track.trackId)}
      data-testid={`track-row-${track.trackId}`}
    >
      <span className={styles.rowTitle}>{track.title}</span>
      <span className={cx(styles.rowStatus, styles.rowStatusLive)}>
        {track.currentLabel ?? track.statusLabel}
      </span>
    </Card>
  );
}
