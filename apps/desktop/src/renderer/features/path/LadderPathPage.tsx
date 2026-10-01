import { useNavigate } from 'react-router';
import {
  sessionRoute,
  useMe,
  useSetTrackSettings,
  useStartSession,
  useTrackOverview,
  useTracks,
} from '../shared/hooks';
import { LadderPathView } from './LadderPathView';

/**
 * `/tracks/:trackId` for `map:'ladder'` (docs/ui.md §3, EarPath.dc.html): stages from
 * `tracks.overview`, "Start Level N" → `sessions.start` → `/ear/:levelId?session=`.
 */
export function LadderPathPage({ trackId }: { trackId: string }) {
  const navigate = useNavigate();
  const me = useMe();
  const tracks = useTracks();
  const overview = useTrackOverview(trackId);
  const start = useStartSession();
  const settings = useSetTrackSettings();

  if (overview.isError) throw overview.error;

  return (
    <LadderPathView
      streakDays={me.data?.streak.days ?? 0}
      xp={me.data?.xpTotal ?? 0}
      tracks={tracks.data ?? []}
      overview={overview.data}
      trackId={trackId}
      starting={start.isPending}
      onStart={(levelId) => {
        if (start.isPending) return;
        start.mutate(
          { levelId, kind: 'learn' },
          { onSuccess: (session) => void navigate(sessionRoute(session)) },
        );
      }}
      onVisibility={(visibility) => settings.mutate({ trackId, visibility })}
    />
  );
}
