import { ButtonBase } from '../../components/ui/ButtonBase';
import { Card } from '../../components/ui/Card';
import type { FinishedKey } from './path';
import styles from './ReviewFinishedKey.module.css';

export interface ReviewFinishedKeyProps {
  keys: readonly FinishedKey[];
  onPick: (levelId: string) => void;
  /** Disables the keys while a session is being created. */
  busy?: boolean;
}

/**
 * "Review a finished key" (docs/ui.md §3, beyond the design): a flat card (Path:58) listing every
 * done key as an outlined pill (Path:43); picking one starts a review session.
 */
export function ReviewFinishedKey({ keys, onPick, busy = false }: ReviewFinishedKeyProps) {
  return (
    <Card variant="flat" data-testid="review-finished">
      <span className={styles.title}>Pick a key to review</span>
      <div className={styles.keys}>
        {keys.map((k) => (
          <ButtonBase
            key={k.levelId}
            className={styles.key}
            onClick={() => onPick(k.levelId)}
            disabled={busy}
            data-testid={`review-key-${k.levelId}`}
          >
            {k.title}
          </ButtonBase>
        ))}
      </div>
    </Card>
  );
}
