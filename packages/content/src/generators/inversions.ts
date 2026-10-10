// Triad inversions shared by the generators: names, labels and placed voicings.
// (The old exact-voicing `inversions-voice-leading` stub was replaced by the Voice leading
// tracks; decisions.md 2026-10-10 "Voice leading".)
import { type Note, type Triad, placeRoot, spelledNote, stackAbove } from '@cadence/music';

/** Root position, 1st inversion (3rd in the bass), 2nd inversion (5th in the bass). */
export const INVERSIONS = [
  { id: 'root', suffix: '', name: 'root position' },
  { id: 'first', suffix: '⁶', name: '1st inversion' },
  { id: 'second', suffix: '⁶₄', name: '2nd inversion' },
] as const;

/** The chord tone in the bass for inversion `inv`: root, third or fifth. */
export function inversionBass(
  triad: Pick<Triad, 'root' | 'third' | 'fifth'>,
  inv: number,
): Triad['root'] {
  const tones = [triad.root, triad.third, triad.fifth];
  const tone = tones[inv % 3];
  if (tone === undefined) throw new RangeError('triad has three notes');
  return tone;
}

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
