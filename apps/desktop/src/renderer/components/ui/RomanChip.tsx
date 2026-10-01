import type { Quality } from '@cadence/content';
import { pretty } from '@cadence/music';
import { cx } from '../../lib/cx';
import { qualityColor } from '../../lib/quality';
import styles from './RomanChip.module.css';

export type RomanChipState = 'done' | 'current' | 'upcoming' | 'skipped' | 'hinted';

interface Common {
  numeral: string;
  /** Second line (chord short name), shown on the 60/64 sizes. */
  sub?: string;
  /** Path:68 (48) · Learn:44 (52) · Complete:39 (60) · Practice:173 (64). */
  size: 48 | 52 | 60 | 64;
  'data-testid'?: string;
}

export type RomanChipProps = Common &
  (
    | { mode: 'quality'; quality: Quality; emphasized?: boolean }
    | { mode: 'state'; state: RomanChipState }
  );

export function RomanChip(props: RomanChipProps) {
  const { numeral, sub, size } = props;
  const quality = props.mode === 'quality';
  return (
    <span
      className={cx(
        styles.chip,
        styles[`s${size}`],
        quality && props.emphasized && styles.emphasized,
        !quality && styles[props.state],
      )}
      style={quality ? { background: qualityColor(props.quality) } : undefined}
      data-testid={props['data-testid']}
      data-state={quality ? props.quality : props.state}
    >
      <span className={styles.numeral}>{numeral}</span>
      {sub !== undefined && <span className={styles.sub}>{pretty(sub)}</span>}
    </span>
  );
}
