// Diatonic 7th chords (decisions.md 2026-10-18 "7th chords"): each triad of a key plus the
// scale's next third. In a major key: Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7.
import { type Key, scale } from './keys';
import { type Pc, type PitchClass, pcNumber, pretty } from './pitch';
import { type TriadQuality, numeralFor, triadQuality, triadShort } from './triads';

export type SeventhQuality = 'maj7' | '7' | 'm7' | 'm7b5';

export interface Seventh {
  /** Scale degree 1..7. */
  degree: number;
  /** "Imaj7", "ii7", "V7", "viiø7". */
  numeral: string;
  root: PitchClass;
  third: PitchClass;
  fifth: PitchClass;
  seventh: PitchClass;
  pcs: readonly [Pc, Pc, Pc, Pc];
  quality: SeventhQuality;
  /** The triad underneath (chip colours: major, minor, diminished). */
  triadQuality: TriadQuality;
  /** "C major 7th", "G dominant 7th", "B half-diminished 7th". */
  name: string;
  /** "Cmaj7", "G7", "Dm7", "Bø7". */
  short: string;
}

const NAME: Readonly<Record<SeventhQuality, string>> = {
  maj7: 'major 7th',
  '7': 'dominant 7th',
  m7: 'minor 7th',
  m7b5: 'half-diminished 7th',
};
const SUFFIX: Readonly<Record<SeventhQuality, string>> = {
  maj7: 'maj7',
  '7': '7',
  m7: 'm7',
  m7b5: 'ø7',
};

const above = (root: Pc, pc: Pc): number => (((pc - root) % 12) + 12) % 12;

/** The 7th chord on `root`, or null when the four notes are not one of the diatonic kinds. */
export function seventhQuality(root: Pc, third: Pc, fifth: Pc, seventh: Pc): SeventhQuality | null {
  const key = [above(root, third), above(root, fifth), above(root, seventh)].join(',');
  switch (key) {
    case '4,7,11':
      return 'maj7';
    case '4,7,10':
      return '7';
    case '3,7,10':
      return 'm7';
    case '3,6,10':
      return 'm7b5';
    default:
      return null;
  }
}

/** "Imaj7" from "I", "ii7" from "ii", "viiø7" from "vii°". */
function seventhNumeral(triadNumeral: string, quality: SeventhQuality): string {
  if (quality === 'maj7') return `${triadNumeral}maj7`;
  if (quality === 'm7b5') return `${triadNumeral.replace('°', '')}ø7`;
  return `${triadNumeral}7`;
}

/** The seven diatonic 7th chords of a key, stacking degrees d, d+2, d+4, d+6. */
export function diatonicSevenths(key: Key): Seventh[] {
  const notes = scale(key);
  return notes.map((root, i) => {
    const third = notes[(i + 2) % 7];
    const fifth = notes[(i + 4) % 7];
    const seventh = notes[(i + 6) % 7];
    if (third === undefined || fifth === undefined || seventh === undefined) {
      throw new RangeError('scale is not 7 notes');
    }
    const pcs: [Pc, Pc, Pc, Pc] = [
      pcNumber(root),
      pcNumber(third),
      pcNumber(fifth),
      pcNumber(seventh),
    ];
    const quality = seventhQuality(...pcs);
    if (quality === null) throw new RangeError(`${root} 7th is not a diatonic kind`);
    const triad = triadQuality(pcs[0], pcs[1], pcs[2]);
    return {
      degree: i + 1,
      numeral: seventhNumeral(numeralFor(i + 1, triad), quality),
      root,
      third,
      fifth,
      seventh,
      pcs,
      quality,
      triadQuality: triad,
      name: `${pretty(root)} ${NAME[quality]}`,
      short: `${pretty(root)}${SUFFIX[quality]}`,
    };
  });
}

/**
 * The symbol of a triad or 7th chord given root first ("A", "Bm", "G♯°", "Cmaj7", "Bø7"), or
 * null when the notes are neither.
 */
export function chordSymbolOf(notes: readonly PitchClass[]): string | null {
  const [root, third, fifth, seventh] = notes;
  if (root === undefined || third === undefined || fifth === undefined) return null;
  const r = pcNumber(root);
  if (notes.length === 3) {
    try {
      return triadShort(root, triadQuality(r, pcNumber(third), pcNumber(fifth)));
    } catch {
      return null; // not major, minor or diminished
    }
  }
  if (notes.length !== 4 || seventh === undefined) return null;
  const q = seventhQuality(r, pcNumber(third), pcNumber(fifth), pcNumber(seventh));
  return q === null ? null : `${pretty(root)}${SUFFIX[q]}`;
}
