import type { Quality } from '@cadence/content';
import { cx } from '../../lib/cx';
import { QUALITY_LABEL, QUALITY_LABEL_SHORT, qualityColor } from '../../lib/quality';
import styles from './LegendSwatches.module.css';

const ORDER: readonly Quality[] = ['major', 'minor', 'diminished'];

/** Path:61 (sm: "major minor dim") · Learn:75 (md: "major minor diminished"). */
export function LegendSwatches({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const labels = size === 'sm' ? QUALITY_LABEL_SHORT : QUALITY_LABEL;
  return (
    <div className={cx(styles.legend, styles[size])}>
      {ORDER.map((q) => (
        <span key={q} className={styles.item}>
          <span className={styles.swatch} style={{ background: qualityColor(q) }} />
          {labels[q]}
        </span>
      ))}
    </div>
  );
}
