import styles from './Pill.module.css';
import { cx } from '../../lib/cx';

const fmt = new Intl.NumberFormat('en-US');

/** Main:33–35 — lavender pill: "1,240 XP". */
export function XpPill({ xp }: { xp: number }) {
  return (
    <div className={cx(styles.pill, styles.xp)} data-testid="xp-pill">
      <span>{fmt.format(xp)} XP</span>
    </div>
  );
}
