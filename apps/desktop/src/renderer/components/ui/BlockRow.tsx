import { cx } from '../../lib/cx';
import styles from './BlockRow.module.css';
import { CheckIcon } from './icons';

export type BlockKind = 'warmup' | 'learn' | 'review';

export interface BlockRowProps {
  /** 1-based position shown in current/upcoming nodes. */
  index: number;
  state: 'done' | 'current' | 'upcoming';
  kind: BlockKind;
  /** "Warm-up", "Learn · new key", "Review · due today". */
  eyebrow: string;
  /** "2 min · done". */
  detail: string;
  title: string;
  blurb: string;
  /** The last row has no rail below it (Main:89–92). */
  last?: boolean;
}

/** Main:57–101 — one block in "Today's practice". */
export function BlockRow({
  index,
  state,
  kind,
  eyebrow,
  detail,
  title,
  blurb,
  last = false,
}: BlockRowProps) {
  return (
    <div className={cx(styles.row, last && styles.last)} data-testid="block-row" data-state={state}>
      <div className={styles.rail}>
        <div className={cx(styles.node, styles[state])}>
          {state === 'done' ? <CheckIcon size={20} strokeWidth={3} /> : index}
        </div>
        {!last && <div className={styles.line} />}
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={cx(styles.eyebrow, styles[kind])}>{eyebrow}</span>
          <span className={styles.detail}>{detail}</span>
        </div>
        <div className={styles.title}>{title}</div>
        <div className={styles.blurb}>{blurb}</div>
      </div>
    </div>
  );
}
