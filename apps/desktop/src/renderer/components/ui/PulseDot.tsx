import { cx } from '../../lib/cx';
import styles from './PulseDot.module.css';

export interface PulseDotProps {
  size?: 10 | 12;
  tone?: 'teal-deep' | 'dune';
  pulsing?: boolean;
}

/** Practice:33 (10px, MidiPill), Practice:103 (12px, Listening), EarInterval:77. */
export function PulseDot({ size = 10, tone = 'teal-deep', pulsing = false }: PulseDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        styles.dot,
        size === 10 ? styles.s10 : styles.s12,
        tone === 'teal-deep' ? styles.tealDeep : styles.dune,
        pulsing && styles.pulsing,
      )}
    />
  );
}
