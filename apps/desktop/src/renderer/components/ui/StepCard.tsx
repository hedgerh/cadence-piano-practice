import { cx } from '../../lib/cx';
import { CheckIcon } from './icons';
import styles from './StepCard.module.css';

export interface StepCardProps {
  step: number;
  state: 'done' | 'current';
  title: string;
  body: string;
}

/** EarKey:60–77 — the two find-the-key steps. */
export function StepCard({ step, state, title, body }: StepCardProps) {
  return (
    <div className={cx(styles.card, styles[state])} data-testid="step-card" data-state={state}>
      <div className={styles.badge}>
        {state === 'done' ? <CheckIcon size={20} strokeWidth={3} /> : step}
      </div>
      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.body}>{body}</span>
      </div>
    </div>
  );
}
