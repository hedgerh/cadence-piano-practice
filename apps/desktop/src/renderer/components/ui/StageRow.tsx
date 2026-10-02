import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import { Card } from './Card';
import { CheckIcon } from './icons';
import { SegmentedProgress, type Segment, type SegmentAction } from './SegmentedProgress';
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
  /** Per level: a replay action turns that segment into a button (decisions.md "Ear level replay"). */
  levelActions?: readonly (SegmentAction | null)[];
  to?: string;
  last?: boolean;
  /** Rendered under the card, beside the rail (the "Replay a level" toggle and list). */
  footer?: ReactNode;
}

/** EarPath:82–157 — one stage on the ladder path. */
export function StageRow({
  index,
  state,
  title,
  meta,
  blurb,
  levels,
  levelActions,
  to,
  last = false,
  footer,
}: StageRowProps) {
  const current = state === 'current';
  const hasFooter = footer !== undefined && footer !== null && footer !== false;
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
        className={cx(
          styles.card,
          to !== undefined && styles.linked,
          hasFooter ? styles.cardWithFooter : last && styles.lastCard,
        )}
      >
        <div className={styles.head}>
          <span className={styles.title}>{title}</span>
          <span className={cx(styles.meta, current && styles.metaCurrent)}>{meta}</span>
        </div>
        <span className={styles.blurb}>{blurb}</span>
        {current && levels && (
          <SegmentedProgress
            segments={levels}
            {...(levelActions !== undefined ? { actions: levelActions } : {})}
          />
        )}
        {/* EarPath:87 — the card is a link. A cover link (not an <a> around the card) so the
            replay segments can be real buttons without nesting interactive content. */}
        {to !== undefined && (
          <Link to={to} className={styles.cover} aria-label={`${title} · ${meta}`} />
        )}
      </Card>
      {hasFooter && (
        <div className={cx(styles.footer, last && styles.lastFooter)} data-testid="stage-footer">
          {footer}
        </div>
      )}
    </div>
  );
}
