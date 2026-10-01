// engine.md §1 triads.ts — diatonic triads of a key (HANDOFF §4: key → seven chords).
import { type Key, scale } from './keys';
import { type Pc, type PitchClass, pcNumber, pretty } from './pitch';

export type TriadQuality = 'major' | 'minor' | 'diminished';

export interface Triad {
  /** Scale degree 1..7. */
  degree: number;
  /** Roman numeral: upper for major, lower for minor, lower + ° for diminished. */
  numeral: string;
  root: PitchClass;
  third: PitchClass;
  fifth: PitchClass;
  pcs: readonly [Pc, Pc, Pc];
  quality: TriadQuality;
  /** "B minor", "G♯ diminished". */
  name: string;
  /** "Bm", "G♯°", "D". */
  short: string;
}

export const MAJOR_NUMERALS: readonly string[] = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
export const MINOR_NUMERALS: readonly string[] = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

/** Quality from the semitones above the root: (4,7) major, (3,7) minor, (3,6) diminished. */
export function triadQuality(root: Pc, third: Pc, fifth: Pc): TriadQuality {
  const t = (((third - root) % 12) + 12) % 12;
  const f = (((fifth - root) % 12) + 12) % 12;
  if (t === 4 && f === 7) return 'major';
  if (t === 3 && f === 7) return 'minor';
  if (t === 3 && f === 6) return 'diminished';
  throw new RangeError(`not a diatonic triad: intervals ${t}, ${f}`);
}

/** Roman numeral for a degree and quality: numeral(2, 'minor') === "ii". */
export function numeralFor(degree: number, quality: TriadQuality): string {
  const roman = ROMAN[degree - 1];
  if (roman === undefined) throw new RangeError(`degree ${degree} out of range`);
  if (quality === 'major') return roman;
  if (quality === 'minor') return roman.toLowerCase();
  return `${roman.toLowerCase()}°`;
}

/** Display name with ♯/♭: triadName("G#", "diminished") === "G♯ diminished". */
export function triadName(root: PitchClass, quality: TriadQuality): string {
  return `${pretty(root)} ${quality}`;
}

/** Short chord symbol: triadShort("C#", "minor") === "C♯m"; diminished → "°". */
export function triadShort(root: PitchClass, quality: TriadQuality): string {
  const suffix = quality === 'major' ? '' : quality === 'minor' ? 'm' : '°';
  return `${pretty(root)}${suffix}`;
}

/** The seven diatonic triads of a key, stacking degrees d, d+2, d+4. */
export function diatonicTriads(key: Key): Triad[] {
  const notes = scale(key);
  return notes.map((root, i) => {
    const third = notes[(i + 2) % 7];
    const fifth = notes[(i + 4) % 7];
    if (third === undefined || fifth === undefined) throw new RangeError('scale is not 7 notes');
    const pcs: [Pc, Pc, Pc] = [pcNumber(root), pcNumber(third), pcNumber(fifth)];
    const quality = triadQuality(pcs[0], pcs[1], pcs[2]);
    return {
      degree: i + 1,
      numeral: numeralFor(i + 1, quality),
      root,
      third,
      fifth,
      pcs,
      quality,
      name: triadName(root, quality),
      short: triadShort(root, quality),
    };
  });
}
