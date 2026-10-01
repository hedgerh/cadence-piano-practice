import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import type { MidiStatus } from '../../midi/MidiInput';
import styles from './AppHeader.module.css';
import { MidiPill } from './MidiPill';
import { StreakPill } from './StreakPill';
import { XpPill } from './XpPill';

export interface AppHeaderProps {
  active: 'today' | 'tracks';
  streakDays: number;
  xp: number;
  /** Main shows the MIDI pill; Path / EarPath do not (Path:28–36). */
  showMidi?: boolean;
  /** Overrides the live MIDI status (gallery / fixtures). */
  midiStatus?: MidiStatus | undefined;
}

/** Main:20–41 — 76px, 2px line border, wordmark + nav + pills. */
export function AppHeader({
  active,
  streakDays,
  xp,
  showMidi = false,
  midiStatus,
}: AppHeaderProps) {
  return (
    <header className={styles.header} data-testid="app-header">
      <div className={styles.left}>
        <div className={styles.wordmark} data-testid="wordmark">
          Cadence
        </div>
        <nav className={styles.nav}>
          <Link
            to="/"
            className={cx(styles.link, active === 'today' && styles.active)}
            aria-current={active === 'today' ? 'page' : undefined}
          >
            Today
          </Link>
          <Link
            to="/tracks"
            className={cx(styles.link, active === 'tracks' && styles.active)}
            aria-current={active === 'tracks' ? 'page' : undefined}
          >
            Tracks
          </Link>
        </nav>
      </div>
      <div className={styles.right}>
        <StreakPill days={streakDays} />
        <XpPill xp={xp} />
        {showMidi && <MidiPill status={midiStatus} />}
      </div>
    </header>
  );
}
