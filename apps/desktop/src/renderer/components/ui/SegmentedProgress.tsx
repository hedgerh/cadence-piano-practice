import { cx } from '../../lib/cx';
import styles from './SegmentedProgress.module.css';

export type Segment = 'done' | 'current' | 'wrong' | 'empty';

export interface SegmentedProgressProps {
  segments: readonly Segment[];
  /** Practice:41 (420) · EarInterval:40 (520) · EarKey:40 (300) · none for EarPath:93. */
  maxWidth?: 420 | 520 | 300;
  'data-testid'?: string;
}

/** Done teal · current tangerine · wrong lavender (never red) · empty sand-deep. */
export function SegmentedProgress({
  segments,
  maxWidth,
  'data-testid': testId,
}: SegmentedProgressProps) {
  return (
    <div
      className={cx(styles.track, maxWidth !== undefined && styles.grow)}
      style={maxWidth !== undefined ? { maxWidth } : undefined}
      data-testid={testId}
    >
      {segments.map((s, i) => (
        <span key={i} className={cx(styles.seg, styles[s])} data-state={s} />
      ))}
    </div>
  );
}
