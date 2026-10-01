// engine.md §1 voicing.ts — where hints and play-backs put notes on the keyboard.
// Practice.dc.html lines 139–146: A3 C♯4 E4 · B3 D4 F♯4 · C♯4 E4 G♯4 · D3 F♯3 A3 · E3 G♯3 B3 ·
// F♯3 A3 C♯4 · G♯3 B3 D4 — root-position triads with the root placed in D3..C♯4.
import { type Key, scale } from './keys';
import { type Midi, type Note, type Pc, midiToPc, pcNumber, spelledNote } from './pitch';
import { type Triad, diatonicTriads } from './triads';

/** The two-octave practice keyboard: C3 (48) .. B4 (71). */
export const PRACTICE_RANGE: Readonly<{ low: Midi; high: Midi }> = { low: 48, high: 71 };

/** Hint placement rule: the chord root lands in D3 (50) .. C#4 (61). */
export function placeRoot(pc: Pc): Midi {
  return 50 + ((midiToPc(pc) - 2 + 12) % 12);
}

/** Stack pitch classes ascending above a placed root: each note is the next above the previous. */
export function stackAbove(root: Midi, pcs: readonly Pc[]): Midi[] {
  const out: Midi[] = [root];
  let prev = root;
  for (const pc of pcs) {
    const next = prev + ((((midiToPc(pc) - midiToPc(prev)) % 12) + 12) % 12 || 12);
    out.push(next);
    prev = next;
  }
  return out;
}

/** Root-position MIDI voicing of a triad: A major → [57, 61, 64]. */
export function placeTriad(triad: Pick<Triad, 'pcs'>): [Midi, Midi, Midi] {
  const [root, third, fifth] = triad.pcs;
  const stacked = stackAbove(placeRoot(root), [third, fifth]);
  const r = stacked[0];
  const t = stacked[1];
  const f = stacked[2];
  if (r === undefined || t === undefined || f === undefined) throw new RangeError('bad stack');
  return [r, t, f];
}

/** `placeTriad` as spelled notes: A major → ["A3", "C#4", "E4"]. */
export function triadNotes(
  triad: Pick<Triad, 'pcs' | 'root' | 'third' | 'fifth'>,
): [Note, Note, Note] {
  const [r, t, f] = placeTriad(triad);
  return [spelledNote(r, triad.root), spelledNote(t, triad.third), spelledNote(f, triad.fifth)];
}

/**
 * One ascending octave of the key's scale, tonic to tonic (8 notes), with the tonic
 * placed in C3..B3 so every note stays on the practice keyboard.
 */
export function placeScale(key: Key): Note[] {
  const names = scale(key);
  const tonic = PRACTICE_RANGE.low + pcNumber(key.tonic);
  const midis = stackAbove(
    tonic,
    names.slice(1).map((n) => pcNumber(n)),
  );
  midis.push(tonic + 12);
  return midis.map((m, i) => {
    const name = names[i % 7];
    if (name === undefined) throw new RangeError('scale is not 7 notes');
    return spelledNote(m, name);
  });
}

/**
 * I – IV – V – I to establish a key (HANDOFF §4 Sound.cadence): I in root position,
 * IV in second inversion, V in first inversion, I again; each chord carries its root
 * an octave below the chord's root as a bass note. Returns four ascending MIDI arrays.
 */
export function cadenceVoicing(key: Key): Midi[][] {
  const triads = diatonicTriads(key);
  const one = triads[0];
  const four = triads[3];
  const five = triads[4];
  if (one === undefined || four === undefined || five === undefined) {
    throw new RangeError('key has no I, IV, V');
  }
  const tonicMidi = placeRoot(one.pcs[0]);
  const I = stackAbove(tonicMidi, [one.pcs[1], one.pcs[2]]);
  // IV second inversion: its fifth is the tonic, so it sits on the I chord's root.
  const IV = stackAbove(tonicMidi, [four.pcs[0], four.pcs[1]]);
  // V first inversion: its third (the leading tone / subtonic) sits just below the tonic.
  const vThird = tonicMidi - ((((one.pcs[0] - five.pcs[1]) % 12) + 12) % 12);
  const V = stackAbove(vThird, [five.pcs[2], five.pcs[0]]);
  const withBass = (chord: Midi[], rootPc: Pc): Midi[] => {
    const root = chord.find((m) => midiToPc(m) === midiToPc(rootPc));
    if (root === undefined) throw new RangeError('chord has no root');
    return [root - 12, ...chord];
  };
  return [
    withBass(I, one.pcs[0]),
    withBass(IV, four.pcs[0]),
    withBass(V, five.pcs[0]),
    withBass(I, one.pcs[0]),
  ];
}
