// @cadence/content — the content model (zod), track generators, lesson and validator.
// engine.md §2: content is generated at runtime from code and validated at startup.
import { earTraining } from './generators/earTrack';
import { majorDiatonicChords, minorDiatonicChords } from './generators/keyTrack';
import { arpeggios, melodyEcho } from './generators/melodyTracks';
import { diatonicSeventhChords, twoFiveOne } from './generators/seventhsTracks';
import { songs } from './generators/songsTrack';
import { minorProgressions } from './generators/minorProgressionsTrack';
import { bluesScaleTrack, pentatonicScales } from './generators/pentatonicTracks';
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
export * from './generators/melodyTracks';
export * from './generators/songsTrack';
export * from './generators/seventhsTracks';
export * from './generators/minorProgressionsTrack';
export * from './generators/pentatonicTracks';
export * from './lessons/minorPattern';
export * from './lessons/inversionShapes';
export * from './lessons/smoothMoves';
export * from './lessons/arpeggios';
export * from './lessons/echo';
export * from './lessons/songs';
export * from './lessons/sevenths';
export * from './lessons/minorProgressions';
export * from './lessons/pentatonic';
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
    minorProgressions(),
    songs(),
    diatonicSeventhChords(),
    twoFiveOne(),
    majorScales(),
    minorScales(),
    pentatonicScales(),
    bluesScaleTrack(),
    arpeggios(),
    melodyEcho(),
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
