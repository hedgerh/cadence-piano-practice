import type { Lesson } from '@cadence/content';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router';
import { api, queryKey } from '../../lib/api';
import { planBlockFor, trackRoute } from '../path/path';
import {
  KEYS,
  sessionRoute,
  useStartSession,
  useTrack,
  useTrackOverview,
  type TodayDto,
  type TrackOverviewDto,
} from '../shared/hooks';
import { LessonView } from './LessonView';
import styles from './LearnPage.module.css';
import { useLessonPlayback } from './useLessonPlayback';

/** Route `/tracks/:trackId/lesson` (docs/ui.md §3, Learn.dc.html). */
export function LearnPage() {
  const { trackId = '' } = useParams();
  const track = useTrack(trackId);
  const overview = useTrackOverview(trackId);

  if (track.isError) throw track.error;
  if (overview.isError) throw overview.error;
  if (!track.data || !overview.data) {
    return <div className={styles.page} data-testid="learn-loading" />;
  }
  const { lesson } = track.data;
  if (!lesson) return <Navigate to={trackRoute(trackId)} replace />;
  return <LessonScreen key={trackId} lesson={lesson} overview={overview.data} />;
}

/** engine.md §4 lesson-seen: marks the lesson seen and refreshes what gates on it. */
function useLessonSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { trackId: string }) => api['tracks.lessonSeen'](input),
    onSuccess: () =>
      void Promise.all([
        qc.invalidateQueries({ queryKey: KEYS.overview }),
        qc.invalidateQueries({ queryKey: KEYS.today }),
      ]),
  });
}

function LessonScreen({ lesson, overview }: { lesson: Lesson; overview: TrackOverviewDto }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const playback = useLessonPlayback(lesson.hear?.sounds ?? []);
  const seen = useLessonSeen();
  const start = useStartSession();
  const busy = seen.isPending || start.isPending;
  const { trackId } = overview;

  // "Got it — play A minor" → tracks.lessonSeen → sessions.start(learn) → Practice.
  const onCta = () => {
    if (busy) return;
    playback.stop();
    seen.mutate(
      { trackId },
      {
        onSuccess: () => {
          const levelId = overview.upNext?.levelId;
          if (levelId === undefined) {
            void navigate(trackRoute(trackId));
            return;
          }
          // Passive lookup (no fetch): attach today's learn block when the plan has one.
          const today = qc.getQueryData<TodayDto>(queryKey('plan.getToday'));
          const planBlockId = planBlockFor(today?.blocks, levelId, 'learn');
          start.mutate(
            { levelId, kind: 'learn', ...(planBlockId !== undefined ? { planBlockId } : {}) },
            { onSuccess: (session) => void navigate(sessionRoute(session)) },
          );
        },
      },
    );
  };

  return (
    <LessonView
      lesson={lesson}
      backTo={trackRoute(trackId)}
      sounding={playback.sounding}
      playing={playback.playing}
      onHear={playback.play}
      onCta={onCta}
      ctaBusy={busy}
    />
  );
}
