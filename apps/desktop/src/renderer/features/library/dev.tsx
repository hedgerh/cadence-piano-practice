// /dev/screens/library — the track library over every real track (buildTracks), with the
// day-8 progress: Major chords 3 of 12 (joined), Minor scales 2 of 12, Ear training L3 (joined).
// Knob: ?loading=1 (header and intro only).
import { buildTracks } from '@cadence/content';
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router';
import { user } from '../../dev/fixtures/user';
import { librarySections, type TrackCardDto } from './library';
import { LibraryView } from './LibraryView';

const PROGRESS: Record<string, Partial<TrackCardDto>> = {
  'major-diatonic-chords': {
    enrolled: true,
    active: true,
    status: 'in_progress',
    statusLabel: 'In progress',
    done: 3,
    progressText: '3 of 12 keys · C, G, D',
    nextText: 'Next: A',
  },
  'minor-diatonic-chords': { nextText: 'Starts with a 1-min lesson' },
  'minor-scales': {
    enrolled: true,
    active: true,
    status: 'in_progress',
    statusLabel: 'In progress',
    done: 2,
    progressText: '2 of 12 keys · A minor, E minor',
    nextText: 'Next: B minor',
  },
  'ear-training': {
    enrolled: true,
    active: true,
    status: 'in_progress',
    statusLabel: 'In progress',
    done: 2,
    progressText: '2 of 20 levels',
    currentLabel: 'Intervals · Level 3',
  },
};

/** One `plan.getToday` track card per real track, unstarted unless PROGRESS says otherwise. */
export function libraryFixture(): TrackCardDto[] {
  return buildTracks().map((t) => {
    const total = t.levels?.length ?? t.stages?.reduce((n, s) => n + s.levels.length, 0) ?? 0;
    const unit = t.map === 'ladder' ? 'levels' : 'keys';
    return {
      trackId: t.id,
      title: t.title,
      group: t.group,
      blurb: t.blurb,
      map: t.map,
      available: t.available,
      enrolled: false,
      active: false,
      status: t.available ? 'ready' : 'not_started',
      statusLabel: t.available ? 'Ready to start' : 'Not started',
      done: 0,
      total,
      progressText: `0 of ${total} ${unit}`,
      nextText: null,
      currentLabel: null,
      currentLevelId: null,
      ...PROGRESS[t.id],
    };
  });
}

function DevLibrary() {
  const [params] = useSearchParams();
  const loading = params.get('loading') === '1';
  return (
    <LibraryView
      streakDays={user.streakDays}
      xp={user.xp}
      sections={loading ? undefined : librarySections(libraryFixture())}
    />
  );
}

export const devScreens: Record<string, ComponentType> = { library: DevLibrary };
