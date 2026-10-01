// Test helpers shared by the content test files (not exported from the package index).
import type { Level, Stage, Step, Track } from './types';

/** Index into an array, throwing instead of returning undefined. */
export function at<T>(arr: readonly T[] | undefined, i: number): T {
  const v = arr?.[i];
  if (v === undefined) throw new RangeError(`no element at ${i}`);
  return v;
}

export function trackById(tracks: readonly Track[], id: string): Track {
  const t = tracks.find((x) => x.id === id);
  if (!t) throw new RangeError(`no track ${id}`);
  return t;
}

export function stageById(track: Track, id: string): Stage {
  const s = track.stages?.find((x) => x.id === id);
  if (!s) throw new RangeError(`no stage ${id}`);
  return s;
}

/** Every level of a track: circle levels, then stage levels in order. */
export function allLevels(track: Track): Level[] {
  return [...(track.levels ?? []), ...(track.stages ?? []).flatMap((s) => s.levels)];
}

/** Steps then pool. */
export function allSteps(level: Level): Step[] {
  return [...level.steps, ...(level.pool ?? [])];
}
