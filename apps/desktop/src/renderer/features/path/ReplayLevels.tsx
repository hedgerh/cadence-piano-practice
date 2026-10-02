import { ButtonBase } from '../../components/ui/ButtonBase';
import { Card } from '../../components/ui/Card';
import { REPLAY_LIST_TITLE, type ReplayLevel } from './LadderModel';
import styles from './ReplayLevels.module.css';

export interface ReplayLevelsProps {
  stageId: string;
  levels: readonly ReplayLevel[];
  onPick: (levelId: string) => void;
  /** Disables the levels while a session is being created. */
  busy?: boolean;
}

/**
 * "Replay a level" (docs/ui.md §3 EarPath, beyond the design; modelled on ReviewFinishedKey):
 * a flat card (Path:58) listing a stage's passed levels as outlined pills (Path:43). Picking one
 * starts a review session on that level.
 */
export function ReplayLevels({ stageId, levels, onPick, busy = false }: ReplayLevelsProps) {
  return (
    <Card variant="flat" className={styles.card} data-testid={`replay-list-${stageId}`}>
      <span className={styles.title}>{REPLAY_LIST_TITLE}</span>
      <div className={styles.levels}>
        {levels.map((l) => (
          <ButtonBase
            key={l.levelId}
            className={styles.level}
            onClick={() => onPick(l.levelId)}
            disabled={busy}
            data-testid={`replay-level-${l.levelId}`}
          >
            {l.label}
          </ButtonBase>
        ))}
      </div>
    </Card>
  );
}
