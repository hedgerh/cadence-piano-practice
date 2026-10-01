import { cx } from '../../lib/cx';
import styles from './ProgressBar.module.css';

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  tone?: 'tangerine' | 'teal';
  'aria-label'?: string;
}

/** Main:124–126 (tangerine, major track) / Main:138–140 (teal, minor track). */
export function ProgressBar({ value, tone = 'tangerine', 'aria-label': label }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 1000) / 10;
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <div className={cx(styles.fill, styles[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
