import { Navigate, useParams } from 'react-router';
import { useTracks } from '../shared/hooks';
import { PathPage } from './PathPage';
import { LadderPathPage } from './LadderPathPage';

/**
 * `/tracks` → first available track; `/tracks/:trackId` → circle map or ladder map
 * depending on the track's `map` (docs/ui.md §3).
 */
export function TracksRoute() {
  const { trackId } = useParams();
  const tracks = useTracks();

  if (!tracks.data) return null;

  if (trackId === undefined) {
    const first = tracks.data.find((t) => t.available) ?? tracks.data[0];
    return first ? <Navigate to={`/tracks/${first.id}`} replace /> : <Navigate to="/" replace />;
  }

  const track = tracks.data.find((t) => t.id === trackId);
  if (!track) return <Navigate to="/" replace />;
  return track.map === 'ladder' ? (
    <LadderPathPage trackId={track.id} />
  ) : (
    <PathPage trackId={track.id} />
  );
}
