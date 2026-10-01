import { FlameIcon } from './icons';
import styles from './Pill.module.css';
import { cx } from '../../lib/cx';

/** Main:29–32 — sun pill with flame: "8 day streak". */
export function StreakPill({ days }: { days: number }) {
  return (
    <div className={cx(styles.pill, styles.streak)} data-testid="streak-pill">
      <FlameIcon />
      <span>{days} day streak</span>
    </div>
  );
}
