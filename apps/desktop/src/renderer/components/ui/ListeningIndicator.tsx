import styles from './ListeningIndicator.module.css';
import { PulseDot } from './PulseDot';

/** Practice:102–105. */
export function ListeningIndicator({
  children = "Listening — play it whenever you're ready",
}: {
  children?: string;
}) {
  return (
    <div className={styles.indicator} data-testid="listening" role="status">
      <PulseDot size={12} pulsing />
      <span>{children}</span>
    </div>
  );
}
