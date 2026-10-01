import { AppHeader } from '../../components/ui/AppHeader';
import { Card } from '../../components/ui/Card';
import { NumberedList } from '../../components/ui/NumberedList';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { ShowMeControl, type ShowMe } from '../../components/ui/ShowMeControl';
import { StageRow } from '../../components/ui/StageRow';
import { TrackPills } from '../../components/ui/TrackPills';
import type { TrackOverviewDto, TrackSummary } from '../shared/hooks';
import {
  HOW_A_LEVEL_WORKS,
  HOW_A_LEVEL_WORKS_TITLE,
  LADDER_COMPLETE,
  stageEyebrow,
  stageRows,
  trackPills,
  upNextTitle,
} from './LadderModel';
import styles from './LadderPathPage.module.css';

export interface LadderPathViewProps {
  streakDays: number;
  xp: number;
  /** `content.tracks` — the switcher pills. */
  tracks: readonly TrackSummary[];
  /** `tracks.overview` for a ladder track; undefined while it loads (header + pills render). */
  overview: TrackOverviewDto | undefined;
  /** Track id from the route (active pill). */
  trackId: string;
  onStart: (levelId: string) => void;
  starting?: boolean;
  onVisibility: (visibility: ShowMe) => void;
}

/** EarPath.dc.html — the ladder track map, fed by `tracks.overview` (or a fixture). */
export function LadderPathView({
  streakDays,
  xp,
  tracks,
  overview,
  trackId,
  onStart,
  starting = false,
  onVisibility,
}: LadderPathViewProps) {
  const upNext = overview?.upNext ?? null;
  const rows = overview ? stageRows(overview) : [];

  return (
    <div className={styles.page} data-testid="ladder-path">
      <AppHeader active="tracks" streakDays={streakDays} xp={xp} />
      <main className={styles.main}>
        <TrackPills pills={trackPills(tracks, trackId)} />

        {overview && (
          <div className={styles.grid}>
            <section className={styles.info}>
              <div className={styles.intro}>
                <span className={styles.eyebrow} data-testid="ladder-eyebrow">
                  {stageEyebrow(overview)}
                </span>
                <h1 className={styles.h1}>{overview.title}</h1>
                <p className={styles.blurb}>{overview.blurb}</p>
              </div>

              <div className={styles.how} data-testid="ladder-how">
                <span className={styles.howTitle}>{HOW_A_LEVEL_WORKS_TITLE}</span>
                <NumberedList items={HOW_A_LEVEL_WORKS} />
              </div>

              {upNext && (
                <Card variant="highlight" tone="lavender" data-testid="ladder-up-next">
                  <span className={styles.upNextEyebrow}>Up next</span>
                  <span className={styles.upNextTitle}>{upNextTitle(upNext)}</span>
                  {upNext.blurb !== '' && <span className={styles.upNextBody}>{upNext.blurb}</span>}
                </Card>
              )}

              {!upNext && overview.available && (
                <Card variant="highlight" tone="lavender" data-testid="ladder-complete">
                  <span className={styles.upNextEyebrow}>Complete</span>
                  <span className={styles.upNextTitle}>{LADDER_COMPLETE.title}</span>
                  <span className={styles.upNextBody}>{LADDER_COMPLETE.body}</span>
                </Card>
              )}

              {upNext && (
                <div className={styles.cta}>
                  <PrimaryButton
                    onClick={() => onStart(upNext.levelId)}
                    disabled={starting}
                    data-testid="ladder-start"
                  >
                    {upNext.label}
                  </PrimaryButton>
                </div>
              )}

              {/* decisions.md (Task 11, moved in Task 16): the ear track's "Show me" sits under
                  the CTA so "Start Level N" stays above the fold at 1280×820; ear drills read it. */}
              <div className={styles.showMe} data-testid="ladder-show-me">
                <ShowMeControl value={overview.visibility} onChange={onVisibility} />
              </div>
            </section>

            <section className={styles.stages} data-testid="ladder-stages">
              {rows.map((r) => (
                <StageRow key={r.index} {...r} />
              ))}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
