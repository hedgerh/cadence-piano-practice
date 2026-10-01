import { useId } from 'react';
import { cx } from '../../lib/cx';
import styles from './ShowMeControl.module.css';

export type ShowMe = 'num' | 'name' | 'all';

const OPTIONS: ReadonlyArray<{ value: ShowMe; label: string }> = [
  { value: 'num', label: 'Numerals only' },
  { value: 'name', label: 'Chord names' },
  { value: 'all', label: 'All 7 chords' },
];

export interface ShowMeControlProps {
  value: ShowMe;
  onChange: (value: ShowMe) => void;
}

/** Practice:48–55, 188–190 — "Show me" segmented control. */
export function ShowMeControl({ value, onChange }: ShowMeControlProps) {
  const labelId = useId();
  return (
    <div className={styles.control} data-testid="show-me">
      <span className={styles.label} id={labelId}>
        Show me
      </span>
      <div className={styles.well} role="group" aria-labelledby={labelId}>
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={cx(styles.seg, value === o.value && styles.on)}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
