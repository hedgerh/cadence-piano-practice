import { pretty } from '@cadence/music';
import { cx } from '../../lib/cx';
import styles from './AnswerChip.module.css';

export type AnswerChipState = 'active' | 'inactive' | 'correct' | 'chosen-wrong' | 'dimmed';

export interface AnswerChipProps {
  /** `interval` 118×64 (EarInterval:142) · `chord` 104×68 (EarChord:75). */
  size: 'interval' | 'chord';
  primary: string;
  secondary: string;
  state: AnswerChipState;
  onClick?: () => void;
  /** Defaults to every state except `active`. */
  disabled?: boolean;
  'data-testid'?: string;
}

const STATE_CLASS: Readonly<Record<AnswerChipState, string | undefined>> = {
  active: styles.active,
  inactive: styles.inactive,
  correct: styles.correct,
  'chosen-wrong': styles.chosenWrong,
  dimmed: styles.dimmed,
};

export function AnswerChip({
  size,
  primary,
  secondary,
  state,
  onClick,
  disabled,
  'data-testid': testId,
}: AnswerChipProps) {
  return (
    <button
      type="button"
      className={cx(styles.chip, styles[size], STATE_CLASS[state])}
      onClick={onClick}
      disabled={disabled ?? state !== 'active'}
      data-state={state}
      data-testid={testId}
    >
      <span className={styles.primary}>{pretty(primary)}</span>
      <span className={styles.secondary}>{pretty(secondary)}</span>
    </button>
  );
}
