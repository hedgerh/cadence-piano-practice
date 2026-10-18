// Pentatonic and blues scales (decisions.md 2026-10-18 "Pentatonic and blues scales"), spelled
// from the key's own scale so they read in the key's letters.
import { type Key, scale } from './keys';
import { type Note, type PitchClass, parsePitchClass, pcNumber, spelledNote } from './pitch';
import { PRACTICE_RANGE, stackAbove } from './voicing';

const pick = (names: readonly PitchClass[], degrees: readonly number[]): PitchClass[] =>
  degrees.map((d) => {
    const n = names[d];
    if (n === undefined) throw new RangeError('scale is not 7 notes');
    return n;
  });

/** Major pentatonic: degrees 1 2 3 5 6 of a major key (C D E G A). */
export function majorPentatonic(key: Key): PitchClass[] {
  return pick(scale({ tonic: key.tonic, mode: 'major' }), [0, 1, 2, 4, 5]);
}

/** Minor pentatonic: degrees 1 ♭3 4 5 ♭7 of a minor key (A C D E G). */
export function minorPentatonic(key: Key): PitchClass[] {
  return pick(scale({ tonic: key.tonic, mode: 'minor' }), [0, 2, 3, 4, 6]);
}

/**
 * The flat 5th of a minor key, spelled on the 5th's letter (E♭ in A minor); when that would
 * need a double flat (E♭ minor: B𝄫) it is spelled as the sharp 4th (A).
 */
export function flatFive(key: Key): PitchClass {
  const names = scale({ tonic: key.tonic, mode: 'minor' });
  const [fourth, fifth] = pick(names, [3, 4]);
  if (fourth === undefined || fifth === undefined) throw new RangeError('scale is not 7 notes');
  const f = parsePitchClass(fifth);
  if (f.accidental === '#') return f.letter;
  if (f.accidental === '') return `${f.letter}b`;
  const four = parsePitchClass(fourth);
  return four.accidental === 'b' ? four.letter : `${four.letter}#`;
}

/** The blues scale: minor pentatonic plus the flat 5th, the "blue note" (A C D E♭ E G). */
export function bluesScale(key: Key): PitchClass[] {
  const [one, three, four, five, seven] = minorPentatonic(key);
  if (!one || !three || !four || !five || !seven) throw new RangeError('pentatonic is 5 notes');
  return [one, three, four, flatFive(key), five, seven];
}

/**
 * One ascending octave of a run (`names` from its tonic), tonic placed in C3..B3 so it stays on
 * the practice keyboard, ending on the tonic an octave up.
 */
export function placeRun(names: readonly PitchClass[]): Note[] {
  const [tonic] = names;
  if (tonic === undefined) return [];
  const start = PRACTICE_RANGE.low + pcNumber(tonic);
  const midis = stackAbove(
    start,
    names.slice(1).map((n) => pcNumber(n)),
  );
  midis.push(start + 12);
  return midis.map((m, i) => spelledNote(m, names[i % names.length] ?? tonic));
}
