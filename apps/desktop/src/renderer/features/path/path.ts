// Pure view-model helpers for the circle-of-fifths track map (Path.dc.html; docs/ui.md §3
// `/tracks/:trackId`; engine.md §4 trackOverview). Everything is derived from `content.tracks`,
// `content.track` and `tracks.overview`; nothing here knows about a particular track.
import type { Quality } from '@cadence/content';
import { relativeMajor, relativeMinor, type Key } from '@cadence/music';
import type { CircleKey } from '../../components/music/CircleOfFifths/CircleOfFifths';
import type { TrackPill } from '../../components/ui/TrackPills';
import type { TrackDto, TrackOverviewDto, TrackSummary } from '../shared/hooks';

export const trackRoute = (trackId: string) => `/tracks/${trackId}`;
export const lessonRoute = (trackId: string) => `/tracks/${trackId}/lesson`;

/** Path:41–47 — active ink pill, available outlined link, locked (`available:false`) span. */
export function trackPills(tracks: readonly TrackSummary[], activeId: string): TrackPill[] {
  return tracks.map((t) => ({
    id: t.id,
    label: t.title,
    state: t.id === activeId ? 'active' : t.available ? 'available' : 'locked',
    to: trackRoute(t.id),
  }));
}

/** Path:53 — "Track · 3 of 12 keys". */
export const trackEyebrow = (o: Pick<TrackOverviewDto, 'progress'>) =>
  `Track · ${o.progress.label}`;

export interface PatternChip {
  numeral: string;
  quality: Quality;
}

/**
 * Path:58–76 — "The pattern in every major key" + the seven quality-colored numerals, read from
 * the track's first level (every level of a circle track shares the pattern).
 */
export function trackPattern(track: TrackDto): { title: string; chips: PatternChip[] } | null {
  const level = track.levels?.[0];
  if (!level?.key) return null;
  const chips = level.steps.flatMap((s): PatternChip[] =>
    s.quality ? [{ numeral: s.label, quality: s.quality }] : [],
  );
  if (chips.length === 0) return null;
  return { title: `The pattern in every ${level.key.mode} key`, chips };
}

/** ASCII short name ("Ebm", "Gb"); CircleOfFifths renders it with pretty(). */
const keyShort = (k: Key) => `${k.tonic}${k.mode === 'minor' ? 'm' : ''}`;

/**
 * Path:101, 117–128 — the inner ring. Major track: relative minors; minor track (outer ring
 * already minor): relative majors.
 */
export function innerRing(track: TrackDto): { labels: string[]; caption: string } {
  const levels = track.levels ?? [];
  const mode = levels[0]?.key?.mode ?? 'major';
  const labels = levels.map((l) => {
    if (!l.key) return '';
    return keyShort(l.key.mode === 'major' ? relativeMinor(l.key) : relativeMajor(l.key));
  });
  return {
    labels,
    caption: mode === 'major' ? 'inner ring: relative minors' : 'inner ring: relative majors',
  };
}

/**
 * Path:110 sets the slot-6 key (G♭, the enharmonic F♯/G♭ position) at 20px instead of 24.
 * Three-character labels (the minor track's F♯m, E♭m, …) get the same smaller size so they fit.
 */
export const isCompactLabel = (label: string, index: number) =>
  index === 6 || [...label].length >= 3;

export interface CircleHandlers {
  /** Current node: same as the primary CTA. */
  onCurrent: () => void;
  /** Done node: review that key. */
  onDone: (levelId: string) => void;
}

/** Path:104–115 — the twelve outer nodes; done and current are buttons. */
export function circleKeys(o: TrackOverviewDto, handlers: CircleHandlers): CircleKey[] {
  return (o.nodes ?? []).map((n, i): CircleKey => {
    const base = { label: n.label, state: n.state, compact: isCompactLabel(n.label, i) };
    if (n.state === 'done') {
      return {
        ...base,
        onClick: () => handlers.onDone(n.levelId),
        ariaLabel: `${n.title}, complete — review it`,
      };
    }
    if (n.state === 'current') {
      return { ...base, onClick: handlers.onCurrent, ariaLabel: `${n.title}, up next` };
    }
    return base;
  });
}

export interface FinishedKey {
  levelId: string;
  title: string;
}

/** "Review a finished key" (ui.md §3): every done key, circle order. */
export const finishedKeys = (o: TrackOverviewDto): FinishedKey[] =>
  (o.nodes ?? [])
    .filter((n) => n.state === 'done')
    .map((n) => ({ levelId: n.levelId, title: n.title }));

/** The track must be (re-)activated before it can be practiced (engine.md §6.15). */
const needsEnroll = (o: TrackOverviewDto) => !o.enrolled || !o.active;

export interface CircleRunStart {
  /** The first key in circle order (C major / A minor). */
  levelId: string;
  /** Informational: the engine picks the run session's kind itself. */
  kind: 'learn' | 'review';
  enroll: boolean;
}

/**
 * "Play the whole circle" (decisions.md 2026-10-03): once any key is done, start a circle run at
 * the first key in circle order; Complete then chains every key clockwise regardless of completion.
 */
export function circleRunStart(o: TrackOverviewDto): CircleRunStart | null {
  const nodes = o.nodes ?? [];
  const first = nodes[0];
  if (!first || !nodes.some((n) => n.state === 'done')) return null;
  return {
    levelId: first.levelId,
    kind: first.state === 'done' ? 'review' : 'learn',
    enroll: needsEnroll(o),
  };
}
/** engine.md §4 lesson-seen: the lesson comes first until it has been seen once. */
const lessonFirst = (o: TrackOverviewDto) => o.hasLesson && !o.lessonSeen;

export type PrimaryAction =
  | { type: 'none' }
  | { type: 'lesson'; enroll: boolean }
  | { type: 'start'; enroll: boolean; levelId: string };

/**
 * The primary CTA: enroll first when the track isn't active ("Ready to start"), then the lesson
 * when it hasn't been seen, else a learn session on the next key.
 */
export function primaryAction(o: TrackOverviewDto): PrimaryAction {
  if (!o.available || !o.upNext) return { type: 'none' };
  const enroll = needsEnroll(o);
  if (lessonFirst(o)) return { type: 'lesson', enroll };
  return { type: 'start', enroll, levelId: o.upNext.levelId };
}

/** Path:86 "Start A major"; "Start with the lesson" while the lesson is pending. */
export function ctaLabel(o: TrackOverviewDto): string | null {
  if (!o.available || !o.upNext) return null;
  return lessonFirst(o) ? 'Start with the lesson' : o.upNext.label;
}

export interface UpNextCard {
  eyebrow: string;
  title: string;
  body: string;
  /** "Starts with a 1-min lesson" (same copy as Today's track card). */
  note: string | null;
}

/** Path:78–82 — the highlight card: up next / ready to start / complete / coming soon. */
export function upNextCard(o: TrackOverviewDto): UpNextCard {
  if (!o.available) {
    return { eyebrow: 'Coming soon', title: o.title, body: o.blurb, note: null };
  }
  if (!o.upNext) {
    return {
      eyebrow: 'Complete',
      title: 'Every key done',
      body: 'Review any finished key to keep it fresh.',
      note: null,
    };
  }
  return {
    eyebrow: needsEnroll(o) ? 'Ready to start' : 'Up next',
    title: o.upNext.title,
    body: o.upNext.blurb,
    note: lessonFirst(o) ? 'Starts with a 1-min lesson' : null,
  };
}

/** Find today's plan block for a level/kind so the session marks it in progress. */
export function planBlockFor(
  blocks: readonly { id: string; levelId: string; kind: string; status: string }[] | undefined,
  levelId: string,
  kind: string,
): string | undefined {
  return blocks?.find((b) => b.levelId === levelId && b.kind === kind && b.status !== 'done')?.id;
}
