// engine.md §4 ContentService: tracks(), track(id), level(id) (global index),
// step(levelId, stepId), levelOrder(trackId) (ladders flattened by stage order), stageOf(levelId).
import type { Level, Pass, Stage, Step, Track } from '@cadence/content';

export interface LevelRef {
  track: Track;
  level: Level;
  /** Ladder tracks only. */
  stage: Stage | null;
  /** Index of the stage in the track (−1 for circle tracks). */
  stageIndex: number;
  /** Index of the level within its stage (circle: within the track). */
  indexInStage: number;
  /** Index in `levelOrder(track.id)`. */
  order: number;
  /** Ear levels draw questions from `pool`; chord levels play every step. */
  isEar: boolean;
}

export interface TrackSummary {
  id: string;
  title: string;
  /** Library section ("Chords"); the map's pills show this group's tracks. */
  group: string;
  map: Track['map'];
  available: boolean;
}

/** engine.md §2.1: `pass.of` is the question count (10 default). */
export const DEFAULT_PASS: Pass = { correct: 8, of: 10 };

export interface ContentService {
  tracks(): readonly Track[];
  summaries(): TrackSummary[];
  track(id: string): Track | null;
  requireTrack(id: string): Track;
  level(id: string): LevelRef | null;
  requireLevel(id: string): LevelRef;
  step(levelId: string, stepId: string): Step | null;
  /** Chord levels: `steps`; ear levels: `pool`. */
  stepsOf(level: Level): Step[];
  levelOrder(trackId: string): Level[];
  stageOf(levelId: string): Stage | null;
  /** Content position of a track (ties in the plan are broken by content order). */
  trackIndex(trackId: string): number;
  passOf(level: Level): Pass;
  /** "A major" for circle levels, "Intervals · Level 3" for ladder levels. */
  shortTitle(levelId: string): string;
}

export function isEarLevel(level: Level): boolean {
  return level.steps.length === 0 && (level.pool?.length ?? 0) > 0;
}

export function createContentService(tracks: readonly Track[]): ContentService {
  const byTrack = new Map<string, Track>();
  const byLevel = new Map<string, LevelRef>();
  const orders = new Map<string, Level[]>();
  const trackIdx = new Map<string, number>();

  tracks.forEach((track, ti) => {
    byTrack.set(track.id, track);
    trackIdx.set(track.id, ti);
    const order: Level[] = [];
    if (track.stages) {
      track.stages.forEach((stage, si) => {
        stage.levels.forEach((level, li) => {
          byLevel.set(level.id, {
            track,
            level,
            stage,
            stageIndex: si,
            indexInStage: li,
            order: order.length,
            isEar: isEarLevel(level),
          });
          order.push(level);
        });
      });
    } else {
      (track.levels ?? []).forEach((level, li) => {
        byLevel.set(level.id, {
          track,
          level,
          stage: null,
          stageIndex: -1,
          indexInStage: li,
          order: order.length,
          isEar: isEarLevel(level),
        });
        order.push(level);
      });
    }
    orders.set(track.id, order);
  });

  const stepsOf = (level: Level): Step[] =>
    level.steps.length > 0 ? level.steps : (level.pool ?? []);

  const requireLevel = (id: string): LevelRef => {
    const ref = byLevel.get(id);
    if (!ref) throw new Error(`Unknown level "${id}"`);
    return ref;
  };

  return {
    tracks: () => tracks,
    summaries: () =>
      tracks.map((t) => ({
        id: t.id,
        title: t.title,
        group: t.group,
        map: t.map,
        available: t.available,
      })),
    track: (id) => byTrack.get(id) ?? null,
    requireTrack(id) {
      const t = byTrack.get(id);
      if (!t) throw new Error(`Unknown track "${id}"`);
      return t;
    },
    level: (id) => byLevel.get(id) ?? null,
    requireLevel,
    step(levelId, stepId) {
      const ref = byLevel.get(levelId);
      if (!ref) return null;
      return (
        ref.level.steps.find((s) => s.id === stepId) ??
        ref.level.pool?.find((s) => s.id === stepId) ??
        null
      );
    },
    stepsOf,
    levelOrder: (trackId) => orders.get(trackId) ?? [],
    stageOf: (levelId) => byLevel.get(levelId)?.stage ?? null,
    trackIndex: (trackId) => trackIdx.get(trackId) ?? Number.MAX_SAFE_INTEGER,
    passOf: (level) => level.pass ?? DEFAULT_PASS,
    shortTitle(levelId) {
      const ref = requireLevel(levelId);
      return ref.stage ? `${ref.stage.title} · ${ref.level.title}` : ref.level.title;
    },
  };
}
