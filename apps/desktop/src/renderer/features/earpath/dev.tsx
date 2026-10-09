// /dev/screens/ear-path — the ladder map (Task 11) fed by EarPath.dc.html's fixture (no IPC).
// Knobs: ?vis=num|name|all (initial "Show me"), ?stage1=done (Intervals complete, so Scale
// degrees and Chord quality are open — exercises `done` rows and two open stages),
// ?replay=<stageId> (that stage's "Replay a level" list starts open, e.g. ?replay=intervals).
// Lives in its own feature folder because features/path/dev.tsx belongs to Task 10.
import { buildTracks, earTraining } from '@cadence/content';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ShowMe } from '../../components/ui/ShowMeControl';
import { earPathFixture } from '../../dev/fixtures/earPath';
import { user } from '../../dev/fixtures/user';
import type { TrackOverviewDto, TrackSummary } from '../shared/hooks';
import type { LadderLevelDto, StageDto } from '../path/LadderModel';
import { LadderPathView } from '../path/LadderPathView';

const STAGE_IDS = [
  'intervals',
  'scale-degrees',
  'chord-quality',
  'chords-in-key',
  'find-the-key',
] as const;
const LEVEL_COUNTS = [6, 4, 3, 4, 3] as const;

/** `content.tracks` as main returns it: every real track, so the pills stay in step with content. */
export const FIXTURE_TRACKS: TrackSummary[] = buildTracks().map((t) => ({
  id: t.id,
  title: t.title,
  group: t.group,
  map: t.map,
  available: t.available,
}));

let blurbs: ReadonlyMap<string, string> | null = null;
/** Level blurbs from content (engine.md §4 trackOverview passes them through). */
function blurbOf(levelId: string): string {
  blurbs ??= new Map(
    (earTraining().stages ?? []).flatMap((s) => s.levels.map((l) => [l.id, l.blurb ?? ''])),
  );
  return blurbs.get(levelId) ?? '';
}

function levels(stageIdx: number, doneCount: number, open: boolean): LadderLevelDto[] {
  const id = STAGE_IDS[stageIdx] ?? 'stage';
  return Array.from({ length: LEVEL_COUNTS[stageIdx] ?? 1 }, (_, i) => ({
    levelId: `${id}-${i + 1}`,
    title: `Level ${i + 1}`,
    blurb: blurbOf(`${id}-${i + 1}`),
    number: i + 1,
    state: i < doneCount ? 'done' : !open ? 'locked' : i === doneCount ? 'current' : 'upcoming',
  }));
}

/**
 * EarPath:82–157 as a `tracks.overview` DTO. Default = the design (Intervals L3 of 6);
 * `intervalsDone` completes Intervals, opening Scale degrees and Chord quality.
 */
export function fixtureLadderOverview(
  visibility: ShowMe = 'all',
  intervalsDone = false,
): TrackOverviewDto {
  const stages: StageDto[] = earPathFixture.stages.map((s, i): StageDto => {
    const base = { stageId: STAGE_IDS[i] ?? `stage-${i}`, title: s.title, blurb: s.blurb };
    if (i === 0) {
      return intervalsDone
        ? {
            ...base,
            state: 'complete',
            unlockText: null,
            progressText: 'Complete',
            levels: levels(0, 6, true),
          }
        : {
            ...base,
            state: 'open',
            unlockText: null,
            progressText: s.meta,
            levels: levels(0, 2, true),
          };
    }
    if (intervalsDone && (i === 1 || i === 2)) {
      return {
        ...base,
        state: 'open',
        unlockText: null,
        progressText: `Level 1 of ${LEVEL_COUNTS[i] ?? 1}`,
        levels: levels(i, 0, true),
      };
    }
    return {
      ...base,
      state: 'locked',
      unlockText: intervalsDone && i === 3 ? 'Unlocks at Scale degrees L4' : s.meta,
      progressText: null,
      levels: levels(i, 0, false),
    };
  });
  const upNext = intervalsDone
    ? {
        levelId: 'scale-degrees-1',
        title: 'Level 1',
        stageTitle: 'Scale degrees',
        blurb: 'C major: 1, 3 and 5.',
        label: 'Start Level 1',
        route: '/ear/scale-degrees-1',
      }
    : {
        levelId: 'intervals-3',
        title: 'Level 3',
        stageTitle: 'Intervals',
        blurb: earPathFixture.upNext.body,
        label: earPathFixture.cta,
        route: '/ear/intervals-3',
      };
  const done = intervalsDone ? 6 : 2;
  return {
    trackId: 'ear-training',
    title: earPathFixture.title,
    blurb: earPathFixture.blurb,
    map: 'ladder',
    available: true,
    enrolled: true,
    active: true,
    visibility,
    hasLesson: false,
    lessonSeen: false,
    progress: { done, total: 20, label: `${done} of 20 levels` },
    completedTitles: '',
    nodes: null,
    stages,
    upNext,
  };
}

function isShowMe(v: string | null): v is ShowMe {
  return v === 'num' || v === 'name' || v === 'all';
}

function EarPathDevScreen() {
  const [params] = useSearchParams();
  const vis = params.get('vis');
  const [visibility, setVisibility] = useState<ShowMe>(isShowMe(vis) ? vis : 'all');
  return (
    <LadderPathView
      // Re-key so ?replay= applies when only the query string changes.
      key={params.get('replay') ?? ''}
      streakDays={user.streakDays}
      xp={user.xp}
      tracks={FIXTURE_TRACKS}
      overview={fixtureLadderOverview(visibility, params.get('stage1') === 'done')}
      trackId="ear-training"
      onStart={() => undefined}
      onReplay={() => undefined}
      initialReplayStage={params.get('replay')}
      onVisibility={setVisibility}
    />
  );
}

export const devScreens: Record<string, ComponentType> = { 'ear-path': EarPathDevScreen };
