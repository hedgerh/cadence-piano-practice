// Jam's two spaces (decisions.md 2026-10-21): looping progressions, and imported songs.
import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import styles from './JamTabs.module.css';

export function JamTabs({ active }: { active: 'progressions' | 'songs' }) {
  return (
    <nav className={styles.tabs} aria-label="Jam">
      <Link
        to="/jam"
        className={cx(styles.tab, active === 'progressions' && styles.on)}
        aria-current={active === 'progressions' ? 'page' : undefined}
        data-testid="jam-tab-progressions"
      >
        Progressions
      </Link>
      <Link
        to="/jam/songs"
        className={cx(styles.tab, active === 'songs' && styles.on)}
        aria-current={active === 'songs' ? 'page' : undefined}
        data-testid="jam-tab-songs"
      >
        Songs
      </Link>
    </nav>
  );
}
