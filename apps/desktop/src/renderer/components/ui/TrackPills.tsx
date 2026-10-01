import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import styles from './TrackPills.module.css';

export interface TrackPill {
  id: string;
  label: string;
  state: 'active' | 'available' | 'locked';
  /** Where an active/available pill links to. */
  to: string;
}

/** Path:41–47 — the track switcher. Locked tracks are plain spans. */
export function TrackPills({ pills }: { pills: readonly TrackPill[] }) {
  return (
    <div className={styles.pills} data-testid="track-pills">
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
