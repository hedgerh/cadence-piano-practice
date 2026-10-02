import { cx } from '../../lib/cx';
import { ButtonBase } from './ButtonBase';
import styles from './SegmentedProgress.module.css';

export type Segment = 'done' | 'current' | 'wrong' | 'empty';

/** A segment that is also a button (EarPath replay: "Replay Level 2"). */
export interface SegmentAction {
  /** Accessible name, e.g. "Replay Level 2". */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}

export interface SegmentedProgressProps {
  segments: readonly Segment[];
  /** Practice:41 (420) · EarInterval:40 (520) · EarKey:40 (300) · none for EarPath:93. */
  maxWidth?: 420 | 520 | 300;
  /** Per segment: an action turns it into a ≥44px button; the visible bar stays 10px. */
  actions?: readonly (SegmentAction | null)[];
  'data-testid'?: string;
}

/** Done teal · current tangerine · wrong lavender (never red) · empty sand-deep. */
export function SegmentedProgress({
  segments,
  maxWidth,
  actions,
  'data-testid': testId,
}: SegmentedProgressProps) {
  return (
    <div
      className={cx(styles.track, maxWidth !== undefined && styles.grow)}
      style={maxWidth !== undefined ? { maxWidth } : undefined}
      data-testid={testId}
    >
      {segments.map((s, i) => {
        const bar = <span key={i} className={cx(styles.seg, styles[s])} data-state={s} />;
        const action = actions?.[i];
        if (!action) return bar;
        return (
          <ButtonBase
            key={i}
            className={styles.hit}
            onClick={action.onClick}
            disabled={action.disabled}
            aria-label={action.label}
            data-testid={action.testId}
          >
            {bar}
          </ButtonBase>
        );
      })}
    </div>
  );
}
