// Complete.dc.html — the presentational screen. CompletePage (live) and the dev screen (fixture)
// both render this from a CompleteDto.
import { Card } from '../../components/ui/Card';
import { Confetti } from '../../components/ui/Confetti';
import { CheckIcon } from '../../components/ui/icons';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { RomanChip } from '../../components/ui/RomanChip';
import { SecondaryButton } from '../../components/ui/SecondaryButton';
import { StatTile } from '../../components/ui/StatTile';
import { TextButton } from '../../components/ui/TextButton';
import { completeView, type CompleteAction, type CompleteDto } from './complete';
import styles from './CompletePage.module.css';
import { useHandsFreeNext, type Schedule } from './useHandsFreeNext';

export interface CompleteViewProps {
  complete: CompleteDto;
  onAction: (action: CompleteAction) => void;
  /** A start is in flight: the session buttons are disabled. */
  busy?: boolean;
  error?: string | null;
  /** decisions.md 2026-10-01: the profile's `autoContinue` (countdown to "Keep going"). */
  autoContinue?: boolean;
  /** The "Keep going automatically" toggle; persisted by the live page via me.update. */
  onAutoContinueChange?: (on: boolean) => void;
  /** Countdown timer (tests and the dev screen inject one). */
  schedule?: Schedule;
}

const TEST_ID: Record<CompleteAction['kind'], string> = {
  next: 'complete-next',
  replay: 'complete-replay',
  done: 'complete-done',
};

export function CompleteView({
  complete,
  onAction,
  busy = false,
  error = null,
  autoContinue = false,
  onAutoContinueChange,
  schedule,
}: CompleteViewProps) {
  const view = completeView(complete);
  const autoNext = view.autoNext;
  const handsFree = useHandsFreeNext({
    next: autoNext?.action ?? null,
    autoContinue,
    busy,
    onContinue: onAction,
    ...(schedule ? { schedule } : {}),
  });
  const button = (action: CompleteAction | null, as: 'primary' | 'secondary' | 'text') => {
    if (action === null) return null;
    const props = {
      onClick: () => onAction(action),
      disabled: busy && action.kind !== 'done',
      'data-testid': TEST_ID[action.kind],
      children: action.label,
    };
    if (as === 'primary') return <PrimaryButton {...props} />;
    if (as === 'secondary') return <SecondaryButton {...props} />;
    return <TextButton {...props} />;
  };

  return (
    <div className={styles.page} data-testid="complete" data-skipped={view.skipped}>
      <Confetti />
      <Card variant="hero" as="section" data-testid="complete-card">
        <div className={styles.head}>
          <div className={styles.check} data-testid="complete-check">
            {/* Complete:32 — 40px check, stroke 3.2 */}
            <CheckIcon size={40} strokeWidth={3.2} />
          </div>
          <h1 className={styles.title} data-testid="complete-title">
            {view.title}
          </h1>
          <p className={styles.subtitle} data-testid="complete-subtitle">
            {view.subtitle}
          </p>
        </div>

        <div className={styles.chips} data-testid="complete-chips">
          {view.chips.map((c, i) => (
            <RomanChip
              key={c.key}
              mode="state"
              size={60}
              numeral={c.numeral}
              sub={c.sub}
              state={c.state}
              data-testid={`complete-chip-${i}`}
            />
          ))}
        </div>

        <div className={styles.stats} data-testid="complete-stats">
          {view.stats.map((s) => (
            <StatTile key={s.label} value={s.value} label={s.label} tone={s.tone} />
          ))}
        </div>

        <div className={styles.track}>
          <div className={styles.trackLabels}>
            <span data-testid="complete-track">{view.progressLeft}</span>
            {view.progressRight !== null && (
              <span data-testid="complete-next-key">{view.progressRight}</span>
            )}
          </div>
          <ProgressBar value={view.progress} aria-label={view.progressLeft} />
          {view.reviewNote !== '' && (
            <p className={styles.reviewNote} data-testid="complete-review-note">
              {view.reviewNote}
            </p>
          )}
        </div>

        <div className={styles.actions}>
          {button(view.primary, 'primary')}
          {button(view.secondary, 'secondary')}
          {button(view.tertiary, 'text')}
        </div>
        {autoNext !== null && (
          <div className={styles.handsFree} data-testid="complete-hands-free">
            <div className={styles.handsFreeRow}>
              {handsFree.remaining !== null && (
                <>
                  <span className={styles.countdown} role="status" data-testid="complete-countdown">
                    Next: {autoNext.title} in {handsFree.remaining}…
                  </span>
                  <TextButton onClick={handsFree.stay} data-testid="complete-stay">
                    Stay here
                  </TextButton>
                </>
              )}
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  className={styles.toggleBox}
                  checked={autoContinue}
                  onChange={(e) => onAutoContinueChange?.(e.currentTarget.checked)}
                  data-testid="complete-auto-toggle"
                />
                Keep going automatically
              </label>
            </div>
            <p className={styles.caption} data-testid="complete-midi-caption">
              Play any key to keep going.
            </p>
          </div>
        )}
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
