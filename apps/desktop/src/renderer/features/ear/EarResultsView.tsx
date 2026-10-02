// The ear results screen (presentational): EarResultsPage (live) and the dev screen render it.
// Composition from Complete.dc.html (hero card, check, chip strip, stat tiles, buttons).
import { Card } from '../../components/ui/Card';
import { Confetti } from '../../components/ui/Confetti';
import { CheckIcon, NoteIcon } from '../../components/ui/icons';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { SecondaryButton } from '../../components/ui/SecondaryButton';
import { StatTile } from '../../components/ui/StatTile';
import { TextButton } from '../../components/ui/TextButton';
import { cx } from '../../lib/cx';
import { earResultsView, type EarResultsAction } from './earResults';
import styles from './EarResultsPage.module.css';
import type { CompleteDto } from './useEarDrill';

export interface EarResultsViewProps {
  complete: CompleteDto;
  onAction: (action: EarResultsAction) => void;
  busy?: boolean;
  error?: string | null;
}

const TEST_ID: Record<EarResultsAction['kind'], string> = {
  next: 'ear-results-next',
  retry: 'ear-results-retry',
  practice: 'ear-results-practice',
  map: 'ear-results-map',
  drill: 'ear-results-drill',
  back: 'ear-results-back',
  done: 'ear-results-done',
};

export function EarResultsView({
  complete,
  onAction,
  busy = false,
  error = null,
}: EarResultsViewProps) {
  const view = earResultsView(complete);
  const props = (action: EarResultsAction) => ({
    onClick: () => onAction(action),
    disabled: busy && action.kind !== 'done' && action.kind !== 'map',
    'data-testid': TEST_ID[action.kind],
    children: action.label,
  });

  return (
    <div className={styles.page} data-testid="ear-results" data-result={view.result}>
      {view.result === 'pass' && <Confetti />}
      <Card variant="hero" as="section" data-testid="ear-results-card">
        <div className={styles.head}>
          <div className={cx(styles.badge, styles[view.result])} data-testid="ear-results-badge">
            {view.result === 'pass' ? (
              // Complete:32 — 40px check, stroke 3.2
              <CheckIcon size={40} strokeWidth={3.2} />
            ) : (
              <NoteIcon size={40} strokeWidth={2.8} />
            )}
          </div>
          <h1 className={styles.title} data-testid="ear-results-title">
            {view.title}
          </h1>
          <p className={styles.subtitle} data-testid="ear-results-subtitle">
            {view.subtitle}
          </p>
        </div>

        <div className={styles.chips} data-testid="ear-results-chips">
          {view.chips.map((c) => (
            <span
              key={c.key}
              className={cx(styles.chip, styles[c.tone])}
              title={c.title}
              data-tone={c.tone}
            >
              {c.label}
            </span>
          ))}
        </div>

        <div className={styles.stats} data-testid="ear-results-stats">
          {view.stats.map((s) => (
            <StatTile key={s.label} value={s.value} label={s.label} tone={s.tone} />
          ))}
        </div>

        {view.reviewNote !== '' && (
          <p className={styles.reviewNote} data-testid="ear-results-review-note">
            {view.reviewNote}
          </p>
        )}

        <div className={styles.actions}>
          <PrimaryButton {...props(view.primary)} />
          {view.extra !== null && <TextButton {...props(view.extra)} />}
          {view.drill !== null && <SecondaryButton {...props(view.drill)} />}
          <SecondaryButton {...props(view.secondary)} />
        </div>
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
