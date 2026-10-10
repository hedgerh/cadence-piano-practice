// @cadence/content — the content model (zod), track generators, lesson and validator.
// engine.md §2: content is generated at runtime from code and validated at startup.
import { earTraining } from './generators/earTrack';
import { majorDiatonicChords, minorDiatonicChords } from './generators/keyTrack';
import { majorScales, minorScales } from './generators/scaleTrack';
import {
  bassAndChords,
  inversionShapes,
  smoothProgressions,
} from './generators/voiceLeadingTracks';
import type { Track } from './types';

export * from './types';
export * from './ids';
export * from './validate';
export * from './generators/keyTrack';
export * from './generators/scaleTrack';
export * from './generators/inversions';
export * from './generators/voiceLeadingTracks';
export * from './generators/earTrack';
export * from './generators/phrase';
export * from './lessons/minorPattern';
export * from './lessons/inversionShapes';
export * from './lessons/smoothMoves';
export * from './stepNoun';

/**
 * Every track in display order, kept together by `group` (the library lists groups in the order
 * their first track appears). Adding a track = a generator plus one entry here.
 */
export function buildTracks(): Track[] {
  return [
    majorDiatonicChords(),
    minorDiatonicChords(),
    inversionShapes(),
    smoothProgressions(),
    bassAndChords(),
    majorScales(),
    minorScales(),
    earTraining(),
  ];
}

/** Library sections: each group once, in first-appearance order, with its tracks in order. */
export function groupTracks<T extends { group: string }>(
  tracks: readonly T[],
): { group: string; tracks: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const t of tracks) {
    const list = groups.get(t.group);
    if (list) list.push(t);
    else groups.set(t.group, [t]);
  }
  return [...groups].map(([group, list]) => ({ group, tracks: list }));
}
