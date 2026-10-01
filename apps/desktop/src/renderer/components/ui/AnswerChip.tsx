import { pretty } from '@cadence/music';
import { cx } from '../../lib/cx';
import styles from './AnswerChip.module.css';

export type AnswerChipState = 'active' | 'inactive' | 'correct' | 'chosen-wrong' | 'dimmed';

export interface AnswerChipProps {
  /**
   * `interval` 118×64 (EarInterval:142) · `chord` 104×68 (EarChord:75) · `wide` 150×64
   * (not in a design: chord-quality words such as "Diminished" at the interval type size).
   */
  size: 'interval' | 'chord' | 'wide';
  primary: string;
  secondary: string;
  state: AnswerChipState;
  onClick?: () => void;
  /** Overrides the `correct` fill (a tokens.css variable from `qualityColor`). */
  fill?: string | undefined;
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
  fill,
  disabled,
  'data-testid': testId,
}: AnswerChipProps) {
  return (
    <button
      type="button"
      className={cx(styles.chip, styles[size], STATE_CLASS[state])}
      onClick={onClick}
      disabled={disabled ?? state !== 'active'}
      style={fill !== undefined ? { background: fill, borderColor: fill } : undefined}
      data-state={state}
      data-testid={testId}
    >
      <span className={styles.primary}>{pretty(primary)}</span>
      <span className={styles.secondary}>{pretty(secondary)}</span>
    </button>
  );
}
