// @cadence/content — the content model (zod), track generators, lesson and validator.
// engine.md §2: content is generated at runtime from code and validated at startup.
import { earTraining } from './generators/earTrack';
import { inversionsVoiceLeading } from './generators/inversionsTrack';
import { majorDiatonicChords, minorDiatonicChords } from './generators/keyTrack';
import { minorScales } from './generators/scaleTrack';
import type { Track } from './types';

export * from './types';
export * from './ids';
export * from './validate';
export * from './generators/keyTrack';
export * from './generators/scaleTrack';
export * from './generators/inversionsTrack';
export * from './generators/earTrack';
export * from './generators/phrase';
export * from './lessons/minorPattern';

/** All five tracks in display order: major, minor, minor-scales, inversions, ear. */
export function buildTracks(): Track[] {
  return [
    majorDiatonicChords(),
    minorDiatonicChords(),
    minorScales(),
    inversionsVoiceLeading(),
    earTraining(),
  ];
}
