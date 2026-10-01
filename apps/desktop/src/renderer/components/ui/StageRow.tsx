import { cx } from '../../lib/cx';
import { Card } from './Card';
import { CheckIcon } from './icons';
import { SegmentedProgress, type Segment } from './SegmentedProgress';
import styles from './StageRow.module.css';

export interface StageRowProps {
  index: number;
  state: 'done' | 'current' | 'locked';
  title: string;
  /** "Level 3 of 6" (current) or "Unlocks at Intervals L4". */
  meta: string;
  blurb: string;
  /** Current stage: one segment per level (EarPath:93–100). */
  levels?: readonly Segment[];
  to?: string;
  last?: boolean;
}

/** EarPath:82–157 — one stage on the ladder path. */
export function StageRow({
  index,
  state,
  title,
  meta,
  blurb,
  levels,
  to,
  last = false,
}: StageRowProps) {
  const current = state === 'current';
  return (
    <div className={styles.row} data-testid="stage-row" data-state={state}>
      <div className={styles.rail}>
        <div className={cx(styles.node, styles[state])}>
          {state === 'done' ? <CheckIcon size={22} strokeWidth={3} /> : index}
        </div>
        {!last && <div className={styles.line} />}
      </div>
      <Card
        variant="stage"
        active={current}
        className={cx(styles.card, last && styles.lastCard)}
        {...(to !== undefined ? { to } : {})}
      >
        <div className={styles.head}>
          <span className={styles.title}>{title}</span>
          <span className={cx(styles.meta, current && styles.metaCurrent)}>{meta}</span>
        </div>
        <span className={styles.blurb}>{blurb}</span>
        {current && levels && <SegmentedProgress segments={levels} />}
      </Card>
    </div>
  );
}
