// engine.md §2.2 — major and minor scales: 12 levels each around the circle of fifths, steps
// `up` / `down` as `sequence` matches via `placeScale`, played in any octave as long as the run
// keeps going the step's way (decisions.md 2026-10-03 "Minor scales track").
import {
  CIRCLE_MAJOR,
  CIRCLE_MINOR,
  type Key,
  keySignatureText,
  keySlug,
  keyTitle,
  placeScale,
  pretty,
  relativeMajor,
  relativeMinor,
  scale,
} from '@cadence/music';
import type { Level, Track } from '../types';

/**
 * "Relative major: **C major**. Same seven notes, starting on C." — the key sharing this scale's
 * notes (a minor key's 3rd degree, a major key's 6th), spelled from the scale itself.
 */
export function relativeKeyNote(key: Key): string {
  const rel = key.mode === 'minor' ? relativeMajor(key) : relativeMinor(key);
  return `Relative ${rel.mode}: **${keyTitle(rel)}**. Same seven notes, starting on ${pretty(rel.tonic)}.`;
}

/** One key's scale, up then down: id `${keySlug}-scale` ("a-minor-scale", "c-major-scale"). */
export function scaleLevel(key: Key): Level {
  const up = placeScale(key);
  const down = [...up].reverse();
  const title = keyTitle(key);
  return {
    id: `${keySlug(key)}-scale`,
    title,
    key: { tonic: key.tonic, mode: key.mode },
    blurb: `${keySignatureText(key).replace(/, /g, ' · ')} Notes: ${scale(key).map(pretty).join(' · ')}`,
    note: relativeKeyNote(key),
    steps: [
      {
        id: 'up',
        label: 'Up',
        name: `${title} scale, going up`,
        match: { type: 'sequence', notes: up, direction: 'up', anyOctave: true },
      },
      {
        id: 'down',
        label: 'Down',
        name: `${title} scale, going down`,
        match: { type: 'sequence', notes: down, direction: 'down', anyOctave: true },
      },
    ],
  };
}

export function majorScales(): Track {
  return {
    id: 'major-scales',
    title: 'Major scales',
    blurb: 'Play each major scale up and down, one key per level around the circle.',
    group: 'Scales',
    map: 'circle-of-fifths',
    available: true,
    levels: CIRCLE_MAJOR.map((tonic) => scaleLevel({ tonic, mode: 'major' })),
  };
}

export function minorScales(): Track {
  return {
    id: 'minor-scales',
    title: 'Minor scales',
    blurb: 'Play each natural minor scale up and down, one key per level around the circle.',
    group: 'Scales',
    map: 'circle-of-fifths',
    available: true,
    levels: CIRCLE_MINOR.map((tonic) => scaleLevel({ tonic, mode: 'minor' })),
  };
}
