// engine.md §2.2 — major/minor diatonic chords: one level per key around the circle of
// fifths, seven chord steps per level, generated from one rule (HANDOFF §4: key → seven chords).
import {
  CIRCLE_MAJOR,
  CIRCLE_MINOR,
  type Key,
  type PitchClass,
  diatonicTriads,
  keySignatureText,
  keySlug,
  keyTitle,
} from '@cadence/music';
import { minorPatternLesson } from '../lessons/minorPattern';
import type { Level, Track } from '../types';

/**
 * "Three sharps: F♯ · C♯ · G♯. Chords: A · Bm · C♯m · D · E · F♯m · G♯°" (Path.dc.html
 * "Up next" card): `keySignatureText` with the accidental list joined by " · ".
 */
export function keyLevelBlurb(key: Key): string {
  const shorts = diatonicTriads(key).map((t) => t.short);
  return `${keySignatureText(key).replace(/, /g, ' · ')} Chords: ${shorts.join(' · ')}`;
}

/** One level: id = keySlug, title = keyTitle, steps d1..d7 with `chord` matches. */
export function keyLevel(key: Key): Level {
  return {
    id: keySlug(key),
    title: keyTitle(key),
    key: { tonic: key.tonic, mode: key.mode },
    blurb: keyLevelBlurb(key),
    steps: diatonicTriads(key).map((t) => ({
      id: `d${t.degree}`,
      label: t.numeral,
      name: t.name,
      quality: t.quality,
      match: { type: 'chord', notes: [t.root, t.third, t.fifth] },
    })),
  };
}

function circleLevels(circle: readonly PitchClass[], mode: Key['mode']): Level[] {
  return circle.map((tonic) => keyLevel({ tonic, mode }));
}

export function majorDiatonicChords(): Track {
  return {
    id: 'major-diatonic-chords',
    title: 'Major diatonic chords',
    blurb:
      'One key per level, moving clockwise around the circle of fifths. Each level: play all seven chords of the key.',
    group: 'Chords',
    map: 'circle-of-fifths',
    available: true,
    levels: circleLevels(CIRCLE_MAJOR, 'major'),
  };
}

export function minorDiatonicChords(): Track {
  return {
    id: 'minor-diatonic-chords',
    title: 'Minor diatonic chords',
    blurb:
      'One minor key per level, starting from A minor and moving clockwise around the circle of fifths. Each level: play all seven chords of the key.',
    group: 'Chords',
    map: 'circle-of-fifths',
    available: true,
    lesson: minorPatternLesson(),
    levels: circleLevels(CIRCLE_MINOR, 'minor'),
  };
}
