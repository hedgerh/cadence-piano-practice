import { cx } from '../../lib/cx';
import styles from './StatTile.module.css';

export interface StatTileProps {
  value: string;
  label: string;
  tone?: 'ground' | 'lavender';
}

/** Complete:49–60 — "2:14 / time, no tempo", "+40 XP / day 8 streak kept". */
export function StatTile({ value, label, tone = 'ground' }: StatTileProps) {
  return (
    <div className={cx(styles.tile, styles[tone])} data-testid="stat-tile">
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
