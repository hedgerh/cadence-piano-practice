import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { queryKey } from '../../lib/api';
import {
  sessionRoute,
  useMe,
  useSetTrackSettings,
  useStartSession,
  useTrack,
  useTrackOverview,
  useTracks,
  type StartSessionInput,
  type TodayDto,
  type TrackDto,
  type TrackOverviewDto,
  type TrackSummary,
} from '../shared/hooks';
import {
  circleKeys,
  ctaLabel,
  finishedKeys,
  innerRing,
  lessonRoute,
  planBlockFor,
  primaryAction,
  trackEyebrow,
  trackPattern,
  trackPills,
  upNextCard,
} from './path';
import { PathView } from './PathView';
import { ReviewFinishedKey } from './ReviewFinishedKey';
import styles from './PathPage.module.css';

/** Route `/tracks/:trackId` for circle-of-fifths tracks (docs/ui.md §3, Path.dc.html). */
export function PathPage({ trackId }: { trackId: string }) {
  const tracks = useTracks();
  const track = useTrack(trackId);
  const overview = useTrackOverview(trackId);

  if (track.isError) throw track.error;
  if (overview.isError) throw overview.error;
  if (!tracks.data || !track.data || !overview.data) {
    return <div className={styles.page} data-testid="path-loading" />;
  }
  // Keyed so the review card closes when switching tracks via the pills.
  return (
    <TrackPath key={trackId} tracks={tracks.data} track={track.data} overview={overview.data} />
  );
}

function TrackPath({
  tracks,
  track,
  overview,
}: {
  tracks: readonly TrackSummary[];
  track: TrackDto;
  overview: TrackOverviewDto;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const start = useStartSession();
  const settings = useSetTrackSettings();
  const [reviewOpen, setReviewOpen] = useState(false);
  const busy = start.isPending || settings.isPending;
  const trackId = overview.trackId;

  const startLevel = (levelId: string, kind: StartSessionInput['kind']) => {
    if (start.isPending) return;
    // Passive lookup (no fetch): reuse today's plan block so Today shows it in progress.
    const today = qc.getQueryData<TodayDto>(queryKey('plan.getToday'));
    const planBlockId = planBlockFor(today?.blocks, levelId, kind);
    start.mutate(
      { levelId, kind, ...(planBlockId !== undefined ? { planBlockId } : {}) },
      { onSuccess: (session) => void navigate(sessionRoute(session)) },
    );
  };

  const onCta = () => {
    if (busy) return;
    const action = primaryAction(overview);
    if (action.type === 'none') return;
    const go = () =>
      action.type === 'lesson'
        ? void navigate(lessonRoute(trackId))
        : startLevel(action.levelId, 'learn');
    if (action.enroll) settings.mutate({ trackId, active: true }, { onSuccess: go });
    else go();
  };

  const review = (levelId: string) => startLevel(levelId, 'review');
  const ring = innerRing(track);
  const done = finishedKeys(overview);

  return (
    <PathView
      streakDays={me.data?.streak.days ?? 0}
      xp={me.data?.xpTotal ?? 0}
      pills={trackPills(tracks, trackId)}
      eyebrow={trackEyebrow(overview)}
      title={overview.title}
      blurb={overview.blurb}
      pattern={trackPattern(track)}
      upNext={upNextCard(overview)}
      ctaLabel={ctaLabel(overview)}
      onCta={onCta}
      ctaBusy={busy}
      canReview={done.length > 0}
      reviewOpen={reviewOpen}
      onToggleReview={() => setReviewOpen((o) => !o)}
      review={<ReviewFinishedKey keys={done} onPick={review} busy={busy} />}
      circle={{
        keys: circleKeys(overview, { onCurrent: onCta, onDone: review }),
        minors: ring.labels,
        complete: overview.progress.done,
        total: overview.progress.total,
        innerLabel: ring.caption,
      }}
    />
  );
}
