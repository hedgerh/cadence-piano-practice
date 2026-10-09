import { Navigate, useParams } from 'react-router';
import { useTracks } from '../shared/hooks';
import { PathPage } from './PathPage';
import { LadderPathPage } from './LadderPathPage';

/**
 * `/tracks/:trackId` → circle map or ladder map depending on the track's `map` (docs/ui.md §3).
 * `/tracks` itself is the library (features/library); an unknown id goes back there.
 */
export function TracksRoute() {
  const { trackId } = useParams();
  const tracks = useTracks();

  if (!tracks.data) return null;

  const track = tracks.data.find((t) => t.id === trackId);
  if (!track) return <Navigate to="/tracks" replace />;
  return track.map === 'ladder' ? (
    <LadderPathPage trackId={track.id} />
  ) : (
    <PathPage trackId={track.id} />
  );
}
