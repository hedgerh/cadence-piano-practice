// engine.md §2.2 — inversions & voice leading (available:false): 12 major-key levels;
// I / IV / V × root / 1st / 2nd inversion = 9 exact `voicing` steps.
import {
  CIRCLE_MAJOR,
  type Key,
  type Note,
  type Triad,
  diatonicTriads,
  keySignatureText,
  keySlug,
  keyTitle,
  placeRoot,
  spelledNote,
  stackAbove,
} from '@cadence/music';
import type { Level, Step, Track } from '../types';

const INVERSIONS = [
  { id: 'root', suffix: '', name: 'root position' },
  { id: 'first', suffix: '⁶', name: '1st inversion' },
  { id: 'second', suffix: '⁶₄', name: '2nd inversion' },
] as const;

/**
 * Close voicing of a triad in inversion `inv` (0 = root position, 1 = third in the bass,
 * 2 = fifth in the bass): the bass is placed with the hint rule (D3..C♯4) and the other two
 * notes stacked above, so every note stays in C3..B4. Spelled with the triad's own letters.
 */
export function invertedTriadNotes(
  triad: Pick<Triad, 'pcs' | 'root' | 'third' | 'fifth'>,
  inv: number,
): Note[] {
  const names = [triad.root, triad.third, triad.fifth];
  const order = [0, 1, 2].map((i) => (i + inv) % 3);
  const pcs = order.map((i) => triad.pcs[i] ?? 0);
  const [bass = 0, ...rest] = pcs;
  return stackAbove(placeRoot(bass), rest).map((m, i) => {
    const name = names[order[i] ?? 0];
    if (name === undefined) throw new RangeError('triad has three notes');
    return spelledNote(m, name);
  });
}

export function inversionsLevel(key: Key): Level {
  const triads = diatonicTriads(key);
  const primary = [triads[0], triads[3], triads[4]];
  const steps: Step[] = [];
  const shorts: string[] = [];
  for (const triad of primary) {
    if (triad === undefined) throw new RangeError('key has no I, IV, V');
    shorts.push(triad.short);
    INVERSIONS.forEach((inv, i) => {
      steps.push({
        id: `${triad.numeral}-${inv.id}`,
        label: `${triad.numeral}${inv.suffix}`,
        name: `${triad.name}, ${inv.name}`,
        quality: triad.quality,
        match: { type: 'voicing', notes: invertedTriadNotes(triad, i) },
      });
    });
  }
  return {
    id: `${keySlug(key)}-inversions`,
    title: keyTitle(key),
    key: { tonic: key.tonic, mode: key.mode },
    blurb: `${keySignatureText(key)} Chords: ${shorts.join(' · ')} in all three positions.`,
    steps,
  };
}

export function inversionsVoiceLeading(): Track {
  return {
    id: 'inversions-voice-leading',
    title: 'Inversions & voice leading',
    blurb:
      'Play I, IV and V in root position and both inversions, exactly as shown, one key per level.',
    group: 'Chords',
    map: 'circle-of-fifths',
    available: false,
    levels: CIRCLE_MAJOR.map((tonic) => inversionsLevel({ tonic, mode: 'major' })),
  };
}
