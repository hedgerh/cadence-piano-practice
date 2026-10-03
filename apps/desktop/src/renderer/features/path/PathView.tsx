import type { ReactNode } from 'react';
import {
  CircleOfFifths,
  type CircleKey,
} from '../../components/music/CircleOfFifths/CircleOfFifths';
import { AppHeader } from '../../components/ui/AppHeader';
import { Card } from '../../components/ui/Card';
import { LegendSwatches } from '../../components/ui/LegendSwatches';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { RomanChip } from '../../components/ui/RomanChip';
import { SecondaryButton } from '../../components/ui/SecondaryButton';
import { TrackPills, type TrackPill } from '../../components/ui/TrackPills';
import type { PatternChip, UpNextCard } from './path';
import styles from './PathPage.module.css';

export interface PathViewProps {
  streakDays: number;
  xp: number;
  pills: readonly TrackPill[];
  eyebrow: string;
  title: string;
  blurb: string;
  pattern: { title: string; chips: readonly PatternChip[] } | null;
  upNext: UpNextCard;
  /** Primary CTA label; null hides it (track complete / not available). */
  ctaLabel: string | null;
  onCta: () => void;
  ctaBusy?: boolean;
  /** Shows "Review a finished key" when there is at least one done key. */
  canReview: boolean;
  reviewOpen: boolean;
  onToggleReview: () => void;
  /** The ReviewFinishedKey card, rendered under the actions while open. */
  review?: ReactNode;
  /** "Play the whole circle" (decisions.md 2026-10-03); omitted hides the button. */
  onPlayCircle?: (() => void) | undefined;
  circle: {
    keys: readonly CircleKey[];
    minors: readonly string[];
    complete: number;
    total: number;
    innerLabel: string;
  };
}

/** Path.dc.html — the circle-of-fifths track map (fed by `tracks.overview` or a fixture). */
export function PathView({
  streakDays,
  xp,
  pills,
  eyebrow,
  title,
  blurb,
  pattern,
  upNext,
  ctaLabel,
  onCta,
  ctaBusy = false,
  canReview,
  reviewOpen,
  onToggleReview,
  review,
  onPlayCircle,
  circle,
}: PathViewProps) {
  return (
    <div className={styles.page} data-testid="path">
      <AppHeader active="tracks" streakDays={streakDays} xp={xp} />
      <main className={styles.main}>
        <TrackPills pills={pills} />

        <div className={styles.grid}>
          <section className={styles.info}>
            <div className={styles.intro}>
              <span className={styles.eyebrow} data-testid="path-eyebrow">
                {eyebrow}
              </span>
              <h1 className={styles.h1} data-testid="path-title">
                {title}
              </h1>
              <p className={styles.blurb}>{blurb}</p>
            </div>

            {pattern && (
              <Card variant="flat" data-testid="path-pattern">
                <div className={styles.patternHead}>
                  <span className={styles.patternTitle}>{pattern.title}</span>
                  <LegendSwatches size="sm" />
                </div>
                <div className={styles.chips}>
                  {pattern.chips.map((c, i) => (
                    <RomanChip
                      key={i}
                      mode="quality"
                      size={48}
                      numeral={c.numeral}
                      quality={c.quality}
                      data-testid={`pattern-chip-${i}`}
                    />
                  ))}
                </div>
              </Card>
            )}

            <Card variant="highlight" tone="tangerine" data-testid="up-next">
              <span className={styles.eyebrow} data-testid="up-next-eyebrow">
                {upNext.eyebrow}
              </span>
              <span className={styles.upTitle} data-testid="up-next-title">
                {upNext.title}
              </span>
              <span className={styles.upBody} data-testid="up-next-body">
                {upNext.body}
              </span>
              {upNext.note !== null && (
                <span className={styles.upNote} data-testid="up-next-note">
                  {upNext.note}
                </span>
              )}
            </Card>

            {(ctaLabel !== null || canReview || onPlayCircle !== undefined) && (
              <div className={styles.actions}>
                {ctaLabel !== null && (
                  <PrimaryButton onClick={onCta} disabled={ctaBusy} data-testid="path-cta">
                    {ctaLabel}
                  </PrimaryButton>
                )}
                {canReview && (
                  <SecondaryButton
                    onClick={onToggleReview}
                    aria-pressed={reviewOpen}
                    data-testid="review-toggle"
                  >
                    Review a finished key
                  </SecondaryButton>
                )}
                {onPlayCircle !== undefined && (
                  <SecondaryButton
                    onClick={onPlayCircle}
                    disabled={ctaBusy}
                    data-testid="circle-run"
                  >
                    Play the whole circle
                  </SecondaryButton>
                )}
              </div>
            )}

            {reviewOpen && review}
          </section>

          <section className={styles.circleWrap}>
            <CircleOfFifths
              keys={circle.keys}
              minors={circle.minors}
              complete={circle.complete}
              total={circle.total}
              innerLabel={circle.innerLabel}
              data-testid="circle"
            />
          </section>
        </div>
      </main>
    </div>
  );
}
