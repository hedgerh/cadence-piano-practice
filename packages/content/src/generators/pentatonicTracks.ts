// Pentatonic and blues scales (decisions.md 2026-10-18 "Pentatonic and blues scales"): runs up
// and down, any octave, like the scale tracks.
//   - Pentatonic scales: 12 major keys; the major pentatonic, then the relative minor
//     pentatonic — the same five notes from the 6th.
//   - Blues scale: 12 minor keys; minor pentatonic plus the flat 5th (`extraNotes`).
import {
  CIRCLE_MAJOR,
  CIRCLE_MINOR,
  type Key,
  type Note,
  bluesScale,
  flatFive,
  keySignatureText,
  keySlug,
  keyTitle,
  majorPentatonic,
  minorPentatonic,
  placeRun,
  pretty,
  relativeMinor,
} from '@cadence/music';
import { bluesScaleLesson, pentatonicLesson } from '../lessons/pentatonic';
import type { Level, Step, Track } from '../types';

export const BLUES_GROUP = 'Blues';

function runSteps(prefix: string, label: string, title: string, up: Note[]): Step[] {
  const down = [...up].reverse();
  const id = (dir: string) => (prefix === '' ? dir : `${prefix}-${dir}`);
  const lead = label === '' ? '' : `${label} `;
  return [
    {
      id: id('up'),
      label: `${lead}up`.replace(/^./, (c) => c.toUpperCase()),
      name: `${title}, going up`,
      match: { type: 'sequence', notes: up, direction: 'up', anyOctave: true },
    },
    {
      id: id('down'),
      label: `${lead}down`.replace(/^./, (c) => c.toUpperCase()),
      name: `${title}, going down`,
      match: { type: 'sequence', notes: down, direction: 'down', anyOctave: true },
    },
  ];
}

export function pentatonicLevel(key: Key): Level {
  const major = majorPentatonic(key);
  const rel = relativeMinor(key);
  const minor = minorPentatonic(rel);
  const title = keyTitle(key);
  return {
    id: `${keySlug(key)}-pentatonic`,
    title,
    key: { tonic: key.tonic, mode: key.mode },
    blurb: `${keySignatureText(key).replace(/, /g, ' · ')} Notes: ${major.map(pretty).join(' · ')}`,
    note: `Same five notes: **${title} pentatonic** is **${keyTitle(rel)} pentatonic** from ${pretty(rel.tonic)}.`,
    steps: [
      ...runSteps('major', 'major', `${title} pentatonic`, placeRun(major)),
      ...runSteps('minor', 'minor', `${keyTitle(rel)} pentatonic`, placeRun(minor)),
    ],
  };
}

export function pentatonicScales(): Track {
  return {
    id: 'pentatonic-scales',
    title: 'Pentatonic scales',
    blurb:
      'Five notes that sound good over almost anything: the major pentatonic and its relative minor, up and down. One key per level.',
    group: 'Scales',
    map: 'circle-of-fifths',
    available: true,
    lesson: pentatonicLesson(),
    levels: CIRCLE_MAJOR.map((tonic) => pentatonicLevel({ tonic, mode: 'major' })),
  };
}

export function bluesScaleLevel(key: Key): Level {
  const names = bluesScale(key);
  const blue = flatFive(key);
  const title = keyTitle(key);
  return {
    id: `${keySlug(key)}-blues-scale`,
    title,
    key: { tonic: key.tonic, mode: key.mode },
    blurb: `Notes: ${names.map(pretty).join(' · ')}`,
    note: `The **blue note** is the flat 5th, **${pretty(blue)}** — it leans into the 5th or the 4th either side.`,
    extraNotes: [blue],
    steps: runSteps('', '', `${title} blues scale`, placeRun(names)),
  };
}

export function bluesScaleTrack(): Track {
  return {
    id: 'blues-scale',
    title: 'Blues scale',
    blurb:
      'The minor pentatonic plus one bent-sounding note: the scale behind blues and rock solos. One key per level.',
    group: BLUES_GROUP,
    map: 'circle-of-fifths',
    available: true,
    lesson: bluesScaleLesson(),
    levels: CIRCLE_MINOR.map((tonic) => bluesScaleLevel({ tonic, mode: 'minor' })),
  };
}
