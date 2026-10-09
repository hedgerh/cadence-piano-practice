import { useMe, useToday } from '../shared/hooks';
import { librarySections } from './library';
import { LibraryView } from './LibraryView';

/** Route `/tracks` (ui.md §3): the grouped track library. */
export function LibraryPage() {
  const me = useMe();
  const today = useToday();
  if (today.isError) throw today.error;
  return (
    <LibraryView
      streakDays={me.data?.streak.days ?? 0}
      xp={me.data?.xpTotal ?? 0}
      sections={today.data ? librarySections(today.data.tracks) : undefined}
    />
  );
}
