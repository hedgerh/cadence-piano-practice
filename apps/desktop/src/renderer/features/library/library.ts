// The track library (`/tracks`, decisions.md 2026-10-08 "Track library"): every track, grouped
// by its content `group`, as cards built from `plan.getToday().tracks`. Pure, no IPC, so the unit
// tests import it directly. Nothing here knows a particular track: adding one to
// `buildTracks()` adds a card (and a section, for a new group) with no renderer change.
import { groupTracks } from '@cadence/content';
import type { ChannelOutput } from '@shared/ipc/contracts';

export type TrackCardDto = ChannelOutput<'plan.getToday'>['tracks'][number];

export interface LibraryCard {
  trackId: string;
  title: string;
  blurb: string;
  /** Unavailable tracks are muted, not links. */
  to: string | null;
  /** "In progress" · "Ready to start" · "Complete" · "Coming soon". */
  status: string;
  /** In progress: tangerine border, bar and status (Main:119–125); otherwise teal (Main:136). */
  tone: 'warm' | 'cool' | 'muted';
  /** 0..1, or null when there is no bar (unavailable tracks). */
  progress: number | null;
  /** "3 of 12 keys · C, G, D" (null when unavailable). */
  progressText: string | null;
  /** "Next: A" · "Intervals · Level 3" · "Starts with a 1-min lesson". */
  nextText: string | null;
  /** Joined: on the learner's daily plan. */
  joined: boolean;
}

export interface LibrarySection {
  group: string;
  cards: LibraryCard[];
}

export const libraryTrackRoute = (trackId: string) => `/tracks/${trackId}`;

export function libraryCard(t: TrackCardDto): LibraryCard {
  if (!t.available) {
    return {
      trackId: t.trackId,
      title: t.title,
      blurb: t.blurb,
      to: null,
      status: 'Coming soon',
      tone: 'muted',
      progress: null,
      progressText: null,
      nextText: null,
      joined: false,
    };
  }
  const inProgress = t.status === 'in_progress';
  return {
    trackId: t.trackId,
    title: t.title,
    blurb: t.blurb,
    to: libraryTrackRoute(t.trackId),
    status: t.statusLabel,
    tone: inProgress ? 'warm' : 'cool',
    progress: t.total > 0 ? t.done / t.total : 0,
    progressText: t.progressText,
    nextText: t.map === 'ladder' && inProgress ? t.currentLabel : t.nextText,
    joined: t.enrolled && t.active,
  };
}

/** Sections in content order (first appearance of each group), cards in content order. */
export function librarySections(tracks: readonly TrackCardDto[]): LibrarySection[] {
  return groupTracks(tracks).map(({ group, tracks: list }) => ({
    group,
    cards: list.map(libraryCard),
  }));
}

/** The library intro under the "Tracks" heading. */
export const LIBRARY_SUBTITLE =
  'Everything you can learn. Each track is a path of short levels — open one to see its map and start.';
