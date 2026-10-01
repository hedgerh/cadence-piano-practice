// Pure mapping from `tracks.overview` (ladder) to the EarPath.dc.html view (Task 11).
// The stage list, unlock copy and level progress all come from the engine
// (docs/engine.md §4 trackOverview, §6.9); nothing here knows the ear-training content.
import type { Segment } from '../../components/ui/SegmentedProgress';
import type { StageRowProps } from '../../components/ui/StageRow';
import type { TrackPill } from '../../components/ui/TrackPills';
import type { TrackOverviewDto, TrackSummary } from '../shared/hooks';

export type StageDto = NonNullable<TrackOverviewDto['stages']>[number];
export type LadderLevelDto = StageDto['levels'][number];
export type UpNextDto = NonNullable<TrackOverviewDto['upNext']>;

/**
 * EarPath:59–64 — "How a level works". Static renderer copy: it describes the engine's
 * ear-level rules (pass 8/10, +5 play-back XP, misses → review), not track content.
 */
export const HOW_A_LEVEL_WORKS_TITLE = 'How a level works';
export const HOW_A_LEVEL_WORKS = [
  'Ten questions. Replay the sound as often as you like — no penalty.',
  'Name it. Wrong answers show you the right one on the keys.',
  'Play it back on your keyboard to lock it in (+5 XP each).',
  "8 of 10 passes the level. Misses come back in tomorrow's review.",
] as const;

/** Path:41–47 — active ink · available white link · unavailable muted span. */
export function trackPills(tracks: readonly TrackSummary[], activeId: string): TrackPill[] {
  return tracks.map((t) => ({
    id: t.id,
    label: t.title,
    state: t.id === activeId ? 'active' : t.available ? 'available' : 'locked',
    to: `/tracks/${t.id}`,
  }));
}

/** EarPath:93–100 — done teal · current tangerine · everything else empty (sand-deep). */
export function levelSegment(state: LadderLevelDto['state']): Segment {
  if (state === 'done') return 'done';
  if (state === 'current') return 'current';
  return 'empty';
}

function containsLevel(stage: StageDto, levelId: string | undefined): boolean {
  return levelId !== undefined && stage.levels.some((l) => l.levelId === levelId);
}

/**
 * EarPath:82–157 — one StageRow per engine stage, in content order.
 * open → `current` (tangerine node, "Level N of M", level segments) ·
 * locked → `locked` (engine `unlockText`) · complete → `done` (teal check, "Complete").
 * The stage holding `upNext` links to its route (EarPath:87 — the current card is a link).
 */
export function stageRows(overview: TrackOverviewDto): StageRowProps[] {
  const stages = overview.stages ?? [];
  const upNext = overview.upNext ?? undefined;
  return stages.map((stage, i): StageRowProps => {
    const base = {
      index: i + 1,
      title: stage.title,
      blurb: stage.blurb,
      last: i === stages.length - 1,
    };
    if (stage.state === 'complete') {
      return { ...base, state: 'done', meta: stage.progressText ?? 'Complete' };
    }
    if (stage.state === 'locked') {
      return { ...base, state: 'locked', meta: stage.unlockText ?? '' };
    }
    const to = upNext && containsLevel(stage, upNext.levelId) ? upNext.route : undefined;
    return {
      ...base,
      state: 'current',
      meta: stage.progressText ?? '',
      levels: stage.levels.map((l) => levelSegment(l.state)),
      ...(to !== undefined ? { to } : {}),
    };
  });
}

/**
 * EarPath:53 — "Track · stage 1 of 5": the stage holding up-next, else the first stage that
 * is not complete, else the last stage.
 */
export function stageEyebrow(overview: TrackOverviewDto): string {
  const stages = overview.stages ?? [];
  const upNextId = overview.upNext?.levelId;
  let n = stages.findIndex((s) => containsLevel(s, upNextId));
  if (n < 0) n = stages.findIndex((s) => s.state !== 'complete');
  if (n < 0) n = stages.length - 1;
  return `Track · stage ${n + 1} of ${stages.length}`;
}

/** EarPath:70 — "Intervals · Level 3". */
export function upNextTitle(upNext: UpNextDto): string {
  return upNext.stageTitle !== null ? `${upNext.stageTitle} · ${upNext.title}` : upNext.title;
}
