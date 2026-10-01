// engine.md §2.2 — minor scales (available:false): 12 levels over CIRCLE_MINOR,
// steps `up` / `down` as `sequence` matches via `placeScale`.
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
    blurb: `${keySignatureText(key)} Notes: ${scale(key).map(pretty).join(' · ')}`,
    steps: [
      {
        id: 'up',
        label: 'Up',
        name: `${title} scale, going up`,
        match: { type: 'sequence', notes: up, direction: 'up' },
      },
      {
        id: 'down',
        label: 'Down',
        name: `${title} scale, going down`,
        match: { type: 'sequence', notes: down, direction: 'down' },
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
    available: false,
    levels: CIRCLE_MINOR.map((tonic) => minorScaleLevel({ tonic, mode: 'minor' })),
  };
}
