import { useNavigate } from 'react-router';
import {
  sessionRoute,
  useMe,
  useSetTrackSettings,
  useStartSession,
  useTrack,
  useTrackOverview,
  useTracks,
} from '../shared/hooks';
import { freePracticeRoutes } from './LadderModel';
import { LadderPathView } from './LadderPathView';

/**
 * `/tracks/:trackId` for `map:'ladder'` (docs/ui.md §3, EarPath.dc.html): stages from
 * `tracks.overview`, "Start Level N" → `sessions.start` → `/ear/:levelId?session=`; a passed
 * level's segment or "Replay a level" pill starts a `review` session the same way.
 */
export function LadderPathPage({ trackId }: { trackId: string }) {
  const navigate = useNavigate();
  const me = useMe();
  const tracks = useTracks();
  const overview = useTrackOverview(trackId);
  const track = useTrack(trackId);
  const start = useStartSession();
  const settings = useSetTrackSettings();

  if (overview.isError) throw overview.error;

  // A replay is a `review` session on a passed level (decisions.md "Ear level replay"); the
  // engine claims today's plan block only if one is for that level.
  const startLevel = (levelId: string, kind: 'learn' | 'review') => {
    if (start.isPending) return;
    start.mutate(
      { levelId, kind },
      { onSuccess: (session) => void navigate(sessionRoute(session)) },
    );
  };

  return (
    <LadderPathView
      streakDays={me.data?.streak.days ?? 0}
      xp={me.data?.xpTotal ?? 0}
      tracks={tracks.data ?? []}
      overview={overview.data}
      trackId={trackId}
      starting={start.isPending}
      onStart={(levelId) => startLevel(levelId, 'learn')}
      onReplay={(levelId) => startLevel(levelId, 'review')}
      onVisibility={(visibility) => settings.mutate({ trackId, visibility })}
      freePractice={freePracticeRoutes(track.data?.stages)}
    />
  );
}
