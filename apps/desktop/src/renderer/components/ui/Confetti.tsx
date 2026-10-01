import { cx } from '../../lib/cx';
import styles from './Confetti.module.css';

const PIECES = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] as const;

/**
 * Complete:20–26. Render inside a `position: relative; overflow: hidden` page
 * (Complete:18). Decorative only.
 */
export function Confetti() {
  return (
    <>
      {PIECES.map((p) => (
        <div key={p} aria-hidden="true" className={cx(styles.piece, styles[p])} />
      ))}
    </>
  );
}
