// The "Melody" group (decisions.md 2026-10-17 "Melody tracks"; docs/roadmap.md phases 3–4):
// two circle-of-fifths tracks over the 12 major keys, right hand, any octave.
//   - Arpeggios & chord tones: I, IV, V and vi broken up to the octave and back (`sequence` +
//     `shape`), then the roots, 3rds and 5ths through I–IV–V–I and the 3rds of I–V–vi–IV, one
//     note per chord (`sequence` + `anyOctave`, a chip per chord).
//   - Melody echo: Cadence plays a short phrase (`play`), you play it back in any octave
//     (`sequence` + `shape`); two phrases per tier, tiers 1–4 (`echoPhrase`).
import {
  CIRCLE_MAJOR,
  type Key,
  type Note,
  type PitchClass,
  type Triad,
  diatonicTriads,
  pcNumber,
  pretty,
  spelledNote,
  stackAbove,
} from '@cadence/music';
import { numeralAscii, stepKey } from '../ids';
import { arpeggiosLesson } from '../lessons/arpeggios';
import { echoLesson } from '../lessons/echo';
import type { Level, Step, Track } from '../types';
import { levelBase, triadAt } from './levelBits';
import { ECHO_LENGTH, type EchoTier, echoPhrase } from './phrase';

export const MELODY_GROUP = 'Melody';
/** Degrees (0 = I) of the arpeggios: I, IV, V, vi. */
const ARPEGGIO_DEGREES = [0, 3, 4, 5] as const;
/** Spacing of a demonstrated arpeggio. */
export const ARPEGGIO_GAP_MS = 380;
/** Spacing of an echo phrase: slow enough to follow, quick enough to hear as a line. */
export const ECHO_GAP_MS = 600;

/** `name` placed in C4..B4 (any octave is accepted; this is where hints light). */
function placed(name: PitchClass): Note {
  const m = stackAbove(59, [pcNumber(name)])[1] ?? 60;
  return spelledNote(m, name);
}

/** Root, 3rd, 5th, octave, then back down: C4 E4 G4 C5 G4 E4 C4. */
export function arpeggioNotes(t: Triad): Note[] {
  const names = [t.root, t.third, t.fifth, t.root];
  const up = stackAbove(59, names.map(pcNumber)).slice(1);
  const notes = up.map((m, i) => spelledNote(m, names[i] ?? t.root));
  return [...notes, ...notes.slice(0, -1).reverse()];
}

function arpeggioStep(t: Triad): Step {
  const notes = arpeggioNotes(t);
  return {
    id: `arp-${numeralAscii(t.numeral)}`,
    label: t.numeral,
    name: `${t.name} arpeggio · up and back down`,
    quality: t.quality,
    match: { type: 'sequence', notes, shape: true },
    hint: { type: 'notes', notes, gapMs: ARPEGGIO_GAP_MS },
  };
}

type Tone = 'root' | 'third' | 'fifth';
const TONE_LABEL: Readonly<Record<Tone, string>> = { root: 'Roots', third: '3rds', fifth: '5ths' };

/** One note per chord: that chord's root, 3rd or 5th, in any octave, a chip per chord. */
function toneStep(id: string, chords: readonly Triad[], tone: Tone): Step {
  const numerals = chords.map((t) => t.numeral).join('–');
  return {
    id,
    label: TONE_LABEL[tone],
    name: `${TONE_LABEL[tone]} of ${numerals}`,
    match: { type: 'sequence', notes: chords.map((t) => placed(t[tone])), anyOctave: true },
    parts: chords.map((t) => ({ label: t.numeral, sub: pretty(t.short), quality: t.quality })),
  };
}

export function arpeggiosLevel(key: Key): Level {
  const triads = diatonicTriads(key);
  const [I, IV, V, vi] = ARPEGGIO_DEGREES.map((d) => triadAt(triads, d));
  if (!I || !IV || !V || !vi) throw new RangeError('missing a triad');
  const oneFourFiveOne = [I, IV, V, I];
  return {
    ...levelBase(key, 'arpeggios', 'Arpeggios of I, IV, V and vi, then chord tones.'),
    noun: 'arpeggio',
    note: 'Arpeggios go **up and back down**, starting in any octave. For chord tones, play **one note per chord**, any octave.',
    steps: [
      ...[I, IV, V, vi].map(arpeggioStep),
      toneStep('roots', oneFourFiveOne, 'root'),
      toneStep('thirds', oneFourFiveOne, 'third'),
      toneStep('fifths', oneFourFiveOne, 'fifth'),
      toneStep('pop-thirds', [I, V, vi, IV], 'third'),
    ],
  };
}

export function arpeggios(): Track {
  return {
    id: 'arpeggios',
    title: 'Arpeggios & chord tones',
    blurb:
      'Break each chord into its notes, then find the right note for every chord of a progression. One key per level.',
    group: MELODY_GROUP,
    map: 'circle-of-fifths',
    available: true,
    lesson: arpeggiosLesson(),
    levels: CIRCLE_MAJOR.map((tonic) => arpeggiosLevel({ tonic, mode: 'major' })),
  };
}

// ------------------------------------------------------------------ Melody echo

/** Two phrases per tier, easiest first. */
const ECHO_TIERS: readonly EchoTier[] = [1, 1, 2, 2, 3, 3, 4, 4];
const COUNT_WORD: Readonly<Record<number, string>> = { 3: 'three', 4: 'four', 5: 'five' };

export function echoLevel(key: Key): Level {
  const base = levelBase(key, 'echo', 'Hear a short phrase, play it back.');
  const used: Note[][] = [];
  const steps = ECHO_TIERS.map((tier, i): Step => {
    const id = `e${i + 1}`;
    const notes = echoPhrase(key, stepKey(base.id, id), tier, used);
    used.push(notes);
    return {
      id,
      label: `Echo ${i + 1}`,
      name: `Echo ${i + 1} · ${COUNT_WORD[ECHO_LENGTH[tier]] ?? notes.length} notes`,
      match: { type: 'sequence', notes, shape: true },
      play: { type: 'notes', notes, gapMs: ECHO_GAP_MS },
    };
  });
  const triads = diatonicTriads(key);
  const I = triadAt(triads, 0);
  return {
    ...base,
    noun: 'phrase',
    note: `The first phrases start on **${pretty(I.root)}**, home; later ones on ${pretty(I.root)}, ${pretty(I.third)} or ${pretty(I.fifth)}. Play back what you hear, **in any octave**.`,
    steps,
  };
}

export function melodyEcho(): Track {
  return {
    id: 'melody-echo',
    title: 'Melody echo',
    blurb:
      'Cadence plays a short phrase in the key; you play it back by ear. Phrases grow from three notes to five. One key per level.',
    group: MELODY_GROUP,
    map: 'circle-of-fifths',
    available: true,
    lesson: echoLesson(),
    levels: CIRCLE_MAJOR.map((tonic) => echoLevel({ tonic, mode: 'major' })),
  };
}
