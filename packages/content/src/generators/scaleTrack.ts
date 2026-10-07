// engine.md §2.2 — minor scales: 12 levels over CIRCLE_MINOR, steps `up` / `down` as
// `sequence` matches via `placeScale`, played in any octave as long as the run keeps going
// the step's way (decisions.md 2026-10-03 "Minor scales track").
import {
  CIRCLE_MINOR,
  type Key,
  keySignatureText,
  keySlug,
  keyTitle,
  placeScale,
  pretty,
  scale,
} from '@cadence/music';
import type { Level, Track } from '../types';

export function minorScaleLevel(key: Key): Level {
  const up = placeScale(key);
  const down = [...up].reverse();
  const title = keyTitle(key);
  return {
    id: `${keySlug(key)}-scale`,
    title,
    key: { tonic: key.tonic, mode: key.mode },
    blurb: `${keySignatureText(key).replace(/, /g, ' · ')} Notes: ${scale(key).map(pretty).join(' · ')}`,
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

export function minorScales(): Track {
  return {
    id: 'minor-scales',
    title: 'Minor scales',
    blurb: 'Play each natural minor scale up and down, one key per level around the circle.',
    map: 'circle-of-fifths',
    available: true,
    levels: CIRCLE_MINOR.map((tonic) => minorScaleLevel({ tonic, mode: 'minor' })),
  };
}
