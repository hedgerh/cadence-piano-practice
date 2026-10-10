// engine.md §2.2 ear-training ladder — five stages; stage titles/blurbs from EarPath.dc.html,
// interval names and the level-3 set from EarInterval.dc.html, explain copy in the style of
// EarChord.dc.html ("The IV chord pulls gently away from home. In G, that's C · E · G.").
import {
  CIRCLE_MAJOR,
  CIRCLE_MINOR,
  INTERVALS,
  type Interval,
  type IntervalId,
  type Key,
  LETTERS,
  MAJOR_NUMERALS,
  MINOR_NUMERALS,
  type Note,
  type PitchClass,
  type TriadQuality,
  diatonicTriads,
  keySlug,
  keyTitle,
  midiToPc,
  parsePitchClass,
  pcName,
  pcNumber,
  pretty,
  scale,
  spelledNote,
  transpose,
  triadName,
  triadNotes,
} from '@cadence/music';
import { numeralAscii, pcSlug, stepKey } from '../ids';
import type { Level, Pass, Stage, Step, Track } from '../types';
import { invertedTriadNotes } from './inversions';
import { type PhraseEnd, phrase } from './phrase';

const PASS_TEN: Pass = { correct: 8, of: 10 };
const PASS_FIVE: Pass = { correct: 4, of: 5 };

const keyOf = (key: Key): Key => ({ tonic: key.tonic, mode: key.mode });
const major = (tonic: PitchClass): Key => ({ tonic, mode: 'major' });
const minor = (tonic: PitchClass): Key => ({ tonic, mode: 'minor' });
const pcOfNote = (note: Note): string => note.replace(/-?\d+$/, '');
const prettyNotes = (notes: readonly string[]): string =>
  notes.map((n) => pretty(pcOfNote(n as Note))).join(' · ');

// ---------------------------------------------------------------- intervals

const ALL_INTERVAL_IDS: readonly IntervalId[] = INTERVALS.map((i) => i.id);

interface IntervalLevelDef {
  ids: readonly IntervalId[];
  roots: readonly Note[];
  direction: 'up' | 'down';
  blurb: string;
}

const INTERVAL_LEVELS: readonly IntervalLevelDef[] = [
  {
    ids: ['P1', 'P5', 'P8'],
    roots: ['C4'],
    direction: 'up',
    blurb: 'Unison, perfect 5th and octave, going up from C.',
  },
  {
    ids: ['P1', 'm3', 'M3', 'P5', 'P8'],
    roots: ['C4'],
    direction: 'up',
    blurb: 'Adds the major and minor 3rd to unison, 5th and octave.',
  },
  {
    ids: ['P1', 'M2', 'm3', 'M3', 'P4', 'P5', 'P8'],
    roots: ['C4'],
    direction: 'up',
    // EarPath.dc.html "Up next" card.
    blurb:
      'Adds the perfect 4th and major 2nd to what you know: unison, octave, 5th, major and minor 3rd.',
  },
  {
    ids: ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'P5', 'm6', 'M6', 'P8'],
    roots: ['C4'],
    direction: 'up',
    blurb: 'Adds the minor 2nd, minor 6th and major 6th.',
  },
  {
    ids: ALL_INTERVAL_IDS,
    roots: ['C4', 'D4', 'E4', 'F4', 'G4'],
    direction: 'up',
    blurb: 'All thirteen intervals, now starting from C, D, E, F or G.',
  },
  {
    ids: ALL_INTERVAL_IDS,
    roots: ['C5', 'B4', 'A4', 'G4'],
    direction: 'down',
    blurb: 'All thirteen intervals, going down.',
  },
];

/**
 * Reference tunes for each interval (docs/decisions.md "Adaptive ear selection and focus
 * rounds"): a well-known opening that starts with the interval, ascending and descending.
 */
const ANCHOR_UP: Readonly<Record<IntervalId, string>> = {
  P1: 'Same note twice.',
  m2: 'The Jaws theme — two notes a half step apart.',
  M2: "'Happy Birthday' — the step up to 'birth'.",
  m3: "The first two notes of 'Greensleeves'.",
  M3: "'Oh When the Saints' — the first two notes.",
  P4: "'Here Comes the Bride' — the first two notes.",
  TT: "'The Simpsons' theme — the first two notes.",
  P5: "'Twinkle, Twinkle' — the first two notes.",
  m6: "The 'Love Story' theme — the first two notes.",
  M6: "'My Bonnie Lies Over the Ocean' — the first two notes.",
  m7: "'Somewhere' from West Side Story — the first two notes.",
  M7: "'Take On Me' — the chorus leap.",
  P8: "'Somewhere Over the Rainbow' — the first two notes.",
};

const SING_IT = 'Hear it, then sing it back before you answer.';

const ANCHOR_DOWN: Readonly<Record<IntervalId, string>> = {
  P1: ANCHOR_UP.P1,
  m2: SING_IT,
  M2: "'Mary Had a Little Lamb' — the first two notes.",
  m3: "'Hey Jude' — the first two notes.",
  M3: "'Swing Low, Sweet Chariot' — the first two notes.",
  P4: "'I've Been Working on the Railroad' — the first two notes.",
  TT: SING_IT,
  P5: "'The Flintstones' theme — the first two notes.",
  m6: SING_IT,
  M6: SING_IT,
  m7: SING_IT,
  M7: SING_IT,
  P8: "'Somewhere Over the Rainbow' — the first two notes, turned around.",
};

/** The anchor tune for an interval in a direction. */
export function intervalAnchor(id: IntervalId, dir: 'up' | 'down'): string {
  return (dir === 'up' ? ANCHOR_UP : ANCHOR_DOWN)[id];
}

/**
 * "C up to F. 'Here Comes the Bride' — the first two notes." — the EarInterval.dc.html feedback
 * sentence ("C up to F." · "C, then C again." · "C up to the next C.") plus the anchor tune.
 */
export function intervalExplain(from: Note, to: Note, iv: Interval, dir: 'up' | 'down'): string {
  const a = pretty(pcOfNote(from));
  const b = pretty(pcOfNote(to));
  const where =
    iv.id === 'P1'
      ? `${a}, then ${a} again.`
      : iv.id === 'P8'
        ? `${a} ${dir} to the next ${b}.`
        : `${a} ${dir} to ${b}.`;
  return `${where} ${intervalAnchor(iv.id, dir)}`;
}

function intervalStep(root: Note, iv: Interval, dir: 'up' | 'down'): Step {
  const target = transpose(root, dir === 'up' ? iv.semitones : -iv.semitones);
  return {
    id: `${dir}-${root}-${iv.id}`,
    label: iv.id,
    name: iv.name,
    play: { type: 'notes', notes: [root, target], gapMs: 800 },
    match: { type: 'choice', answer: iv.id, options: [...ALL_INTERVAL_IDS] },
    explain: intervalExplain(root, target, iv, dir),
  };
}

function intervalsStage(): Stage {
  return {
    id: 'intervals',
    title: 'Intervals',
    blurb: 'Hear two notes, name the distance. Ascending first, then descending.',
    levels: INTERVAL_LEVELS.map((def, i): Level => {
      const active = INTERVALS.filter((iv) => def.ids.includes(iv.id));
      return {
        id: `intervals-${i + 1}`,
        title: `Level ${i + 1}`,
        blurb: def.blurb,
        pass: PASS_TEN,
        steps: [],
        pool: def.roots.flatMap((root) =>
          active.map((iv) => intervalStep(root, iv, def.direction)),
        ),
        activeOptions: active.map((iv) => iv.id),
      };
    }),
  };
}

// ---------------------------------------------------------------- scale degrees

export const DEGREE_NAMES: readonly string[] = [
  'Tonic',
  'Supertonic',
  'Mediant',
  'Subdominant',
  'Dominant',
  'Submediant',
  'Leading tone',
];
const DEGREE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7'] as const;

interface DegreeLevelDef {
  keys: readonly Key[];
  degrees: readonly number[];
  blurb: string;
}

const DEGREE_LEVELS: readonly DegreeLevelDef[] = [
  {
    keys: [major('C')],
    degrees: [1, 3, 5],
    blurb: 'In C major: the tonic, 3rd and 5th — the notes of the home chord.',
  },
  {
    keys: [major('C')],
    degrees: [1, 2, 3, 4, 5],
    blurb: 'Adds degrees 2 and 4: the first five notes of C major.',
  },
  {
    keys: [major('C')],
    degrees: [1, 2, 3, 4, 5, 6, 7],
    blurb: 'All seven degrees of C major.',
  },
  {
    keys: [major('G'), major('F')],
    degrees: [1, 2, 3, 4, 5, 6, 7],
    blurb: 'All seven degrees, now in G major and F major.',
  },
];

function degreeStep(key: Key, degree: number): Step {
  const name = scale(key)[degree - 1];
  const degreeName = DEGREE_NAMES[degree - 1];
  if (name === undefined || degreeName === undefined) throw new RangeError('degree 1..7');
  const note = spelledNote(60 + pcNumber(name), name); // a single note in C4..B4
  return {
    id: `${keySlug(key)}-${degree}`,
    label: String(degree),
    name: `${degreeName} (${pretty(name)})`,
    context: { type: 'cadence', key: key.tonic, mode: key.mode },
    play: { type: 'notes', notes: [note], gapMs: 0 },
    match: { type: 'choice', answer: String(degree), options: [...DEGREE_OPTIONS] },
    explain: `In ${keyTitle(key)}, ${pretty(name)} is degree ${degree}, the ${degreeName.toLowerCase()}.`,
  };
}

function scaleDegreesStage(): Stage {
  return {
    id: 'scale-degrees',
    title: 'Scale degrees',
    blurb: 'Hear a key established, then one note. Name its degree: 1 through 7.',
    unlock: { stage: 'intervals', level: 4 },
    levels: DEGREE_LEVELS.map((def, i): Level => {
      const single = def.keys.length === 1 ? def.keys[0] : undefined;
      return {
        id: `scale-degrees-${i + 1}`,
        title: `Level ${i + 1}`,
        ...(single ? { key: keyOf(single) } : {}),
        blurb: def.blurb,
        pass: PASS_TEN,
        steps: [],
        pool: def.keys.flatMap((key) => def.degrees.map((d) => degreeStep(key, d))),
        activeOptions: DEGREE_OPTIONS.filter((o) => def.degrees.includes(Number(o))),
      };
    }),
  };
}

// ---------------------------------------------------------------- chord quality

const QUALITIES: readonly TriadQuality[] = ['major', 'minor', 'diminished'];
const QUALITY_SEMITONES: Readonly<Record<TriadQuality, readonly [number, number]>> = {
  major: [4, 7],
  minor: [3, 7],
  diminished: [3, 6],
};
const QUALITY_EXPLAIN: Readonly<Record<TriadQuality, string>> = {
  major: 'A major 3rd with a minor 3rd on top: bright and settled.',
  minor: 'A minor 3rd with a major 3rd on top: darker, but still at rest.',
  diminished: 'Two minor 3rds stacked: tight and tense.',
};
const INVERSION_NAMES = ['root position', '1st inversion', '2nd inversion'] as const;
const INVERSION_IDS = ['root', 'first', 'second'] as const;

/** A triad spelled on letters root, +2, +4, or null if that needs a double accidental. */
function spellOnThirds(
  root: PitchClass,
  quality: TriadQuality,
): { root: PitchClass; third: PitchClass; fifth: PitchClass } | null {
  const { letter } = parsePitchClass(root);
  const start = LETTERS.indexOf(letter);
  const rootPc = pcNumber(root);
  const spell = (letterOffset: number, semis: number): PitchClass | null => {
    const l = LETTERS[(start + letterOffset) % 7];
    if (l === undefined) return null;
    const acc = ((((midiToPc(rootPc + semis) - pcNumber(l) + 6) % 12) + 12) % 12) - 6;
    if (acc === 0) return l;
    if (acc === 1) return `${l}#`;
    if (acc === -1) return `${l}b`;
    return null;
  };
  const [t, f] = QUALITY_SEMITONES[quality];
  const third = spell(2, t);
  const fifth = spell(4, f);
  return third && fifth ? { root, third, fifth } : null;
}

/** Spell a triad on any root; falls back to the enharmonic root (E♭° → D♯ F♯ A). */
export function spellTriad(
  root: PitchClass,
  quality: TriadQuality,
): { root: PitchClass; third: PitchClass; fifth: PitchClass; pcs: [number, number, number] } {
  const pc = pcNumber(root);
  const candidates = [root, pcName(pc, 'sharps'), pcName(pc, 'flats')];
  for (const candidate of candidates) {
    const spelled = spellOnThirds(candidate, quality);
    if (spelled) {
      const [t, f] = QUALITY_SEMITONES[quality];
      return { ...spelled, pcs: [pc, midiToPc(pc + t), midiToPc(pc + f)] };
    }
  }
  throw new RangeError(`cannot spell ${root} ${quality}`);
}

interface QualityLevelDef {
  roots: readonly PitchClass[];
  qualities: readonly TriadQuality[];
  inversions: readonly number[];
  blurb: string;
}

const QUALITY_ROOTS: readonly PitchClass[] = ['C', 'F', 'G', 'D', 'A', 'E', 'Bb'];
const TWELVE_ROOTS: readonly PitchClass[] = Array.from({ length: 12 }, (_, pc) => pcName(pc));

const QUALITY_LEVELS: readonly QualityLevelDef[] = [
  {
    roots: QUALITY_ROOTS,
    qualities: ['major', 'minor'],
    inversions: [0],
    blurb: 'Major or minor? Every chord in root position.',
  },
  {
    roots: QUALITY_ROOTS,
    qualities: QUALITIES,
    inversions: [0],
    blurb: 'Adds diminished: two minor 3rds stacked.',
  },
  {
    roots: TWELVE_ROOTS,
    qualities: QUALITIES,
    inversions: [0, 1, 2],
    blurb: 'All three qualities from any root, in any inversion.',
  },
];

function qualityStep(root: PitchClass, quality: TriadQuality, inv: number, named: boolean): Step {
  const triad = spellTriad(root, quality);
  const notes = invertedTriadNotes(triad, inv);
  const chordName = triadName(triad.root, quality);
  const name = named ? `${chordName}, ${INVERSION_NAMES[inv] ?? ''}` : chordName;
  return {
    id: named
      ? `${pcSlug(root)}-${quality}-${INVERSION_IDS[inv] ?? inv}`
      : `${pcSlug(root)}-${quality}`,
    label: quality,
    name,
    quality,
    play: { type: 'chord', notes },
    match: { type: 'choice', answer: quality, options: [...QUALITIES] },
    explain: `${chordName}: ${prettyNotes(notes)}. ${QUALITY_EXPLAIN[quality]}`,
  };
}

function chordQualityStage(): Stage {
  return {
    id: 'chord-quality',
    title: 'Chord quality',
    blurb: 'Hear one chord on its own. Major, minor or diminished?',
    unlock: { stage: 'intervals', level: 5 },
    levels: QUALITY_LEVELS.map((def, i): Level => {
      const withInversions = def.inversions.length > 1;
      return {
        id: `chord-quality-${i + 1}`,
        title: `Level ${i + 1}`,
        blurb: def.blurb,
        pass: PASS_TEN,
        steps: [],
        pool: def.roots.flatMap((root) =>
          def.qualities.flatMap((q) =>
            def.inversions.map((inv) => qualityStep(root, q, inv, withInversions)),
          ),
        ),
        activeOptions: QUALITIES.filter((q) => def.qualities.includes(q)),
      };
    }),
  };
}

// ---------------------------------------------------------------- chords in a key

/**
 * Authored feedback for the 14 numerals, `{key}` → "G" / "A minor", `{notes}` → "C · E · G".
 * IV is verbatim from EarChord.dc.html.
 */
export const CHORD_EXPLAIN: Readonly<Record<string, string>> = {
  I: "The I chord is home — everything settles here. In {key}, that's {notes}.",
  ii: "The ii chord is a soft step away that loves to lead to V. In {key}, that's {notes}.",
  iii: "The iii chord is gentle and a little wistful; it shares two notes with I. In {key}, that's {notes}.",
  IV: "The IV chord pulls gently away from home. In {key}, that's {notes}.",
  V: "The V chord is full of tension that wants to resolve home to I. In {key}, that's {notes}.",
  vi: "The vi chord is home's minor twin — the relative minor. In {key}, that's {notes}.",
  'vii°': "The vii° chord is tense and unstable, pulling hard toward I. In {key}, that's {notes}.",
  i: "The i chord is home in a minor key — dark but settled. In {key}, that's {notes}.",
  'ii°': "The ii° chord is shadowy and restless; it leans toward v. In {key}, that's {notes}.",
  III: "The III chord brightens things up — it's the relative major. In {key}, that's {notes}.",
  iv: "The iv chord sinks gently away from home. In {key}, that's {notes}.",
  v: "The v chord leans back toward home, but softly — natural minor has no leading tone. In {key}, that's {notes}.",
  VI: "The VI chord is warm and wide, a bright surprise in a minor key. In {key}, that's {notes}.",
  VII: "The VII chord sits a whole step below home and steps right back up to i. In {key}, that's {notes}.",
};

/** Fill an explain template: major keys read "In G", minor keys "In A minor". */
export function chordExplain(key: Key, numeral: string, notes: readonly string[]): string {
  const template = CHORD_EXPLAIN[numeral];
  if (template === undefined) throw new RangeError(`no explain copy for "${numeral}"`);
  const keyName = key.mode === 'major' ? pretty(key.tonic) : keyTitle(key);
  return template.replace('{key}', keyName).replace('{notes}', prettyNotes(notes));
}

interface ChordsInKeyLevelDef {
  keys: readonly Key[];
  numerals?: readonly string[];
  blurb: string;
}

const CHORDS_IN_KEY_LEVELS: readonly ChordsInKeyLevelDef[] = [
  { keys: [major('C')], numerals: ['I', 'IV', 'V', 'vi'], blurb: 'C major: I, IV, V and vi.' },
  { keys: [major('G')], blurb: 'All seven chords of G major.' },
  { keys: [major('D'), major('F')], blurb: 'All seven chords, in D major and F major.' },
  { keys: [minor('A'), minor('E')], blurb: 'Minor keys: all seven chords of A minor and E minor.' },
];

const numeralsOf = (key: Key): readonly string[] =>
  key.mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS;

function chordsInKeyStage(): Stage {
  return {
    id: 'chords-in-key',
    title: 'Chords in a key',
    blurb:
      'Hear a key, then a chord. Name the roman numeral — the same I to vii° you practice by hand.',
    unlock: { stage: 'scale-degrees', level: 4 },
    levels: CHORDS_IN_KEY_LEVELS.map((def, i): Level => {
      const first = def.keys[0];
      if (first === undefined) throw new RangeError('level needs a key');
      const options = numeralsOf(first);
      const wanted = def.numerals ?? options;
      const pool = def.keys.flatMap((key) =>
        diatonicTriads(key)
          .filter((t) => wanted.includes(t.numeral))
          .map((t): Step => {
            const notes = triadNotes(t);
            return {
              id: `${keySlug(key)}-${numeralAscii(t.numeral)}`,
              label: t.numeral,
              name: t.name,
              quality: t.quality,
              context: { type: 'cadence', key: key.tonic, mode: key.mode },
              play: { type: 'chord', notes },
              match: { type: 'choice', answer: t.numeral, options: [...numeralsOf(key)] },
              explain: chordExplain(key, t.numeral, [t.root, t.third, t.fifth]),
            };
          }),
      );
      return {
        id: `chords-in-key-${i + 1}`,
        title: `Level ${i + 1}`,
        ...(def.keys.length === 1 ? { key: keyOf(first) } : {}),
        blurb: def.blurb,
        pass: PASS_TEN,
        steps: [],
        pool,
        activeOptions: options.filter((n) => wanted.includes(n)),
      };
    }),
  };
}

// ---------------------------------------------------------------- find the key

const PHRASES_PER_KEY = 2;
const MODE_EXPLAIN: Readonly<Record<Key['mode'], string>> = {
  major: 'Its home chord has a major 3rd, so it sounds bright.',
  minor: 'Its home chord has a minor 3rd, so it sounds darker.',
};

interface FindKeyLevelDef {
  keys: readonly Key[];
  end: PhraseEnd;
  blurb: string;
}

const FIRST_TONICS: readonly PitchClass[] = ['C', 'D', 'E', 'F', 'G', 'A'];
const ALL_TWELVE_KEYS: readonly Key[] = [...CIRCLE_MAJOR.map(major), ...CIRCLE_MINOR.map(minor)];

const FIND_KEY_LEVELS: readonly FindKeyLevelDef[] = [
  {
    keys: FIRST_TONICS.flatMap((t) => [major(t), minor(t)]),
    end: 'tonic',
    blurb: 'Major and minor keys on C, D, E, F, G and A. The phrase ends on its home note.',
  },
  {
    keys: ALL_TWELVE_KEYS,
    end: 'tonic',
    blurb: 'All twelve keys, major and minor. The phrase ends on its home note.',
  },
  {
    keys: ALL_TWELVE_KEYS,
    end: 'third-or-fifth',
    blurb: 'All twelve keys. Now the phrase ends on the 3rd or 5th, not on home.',
  },
];

function findKeyStep(levelId: string, key: Key, n: number, end: PhraseEnd): Step {
  const id = `${keySlug(key)}-${n}`;
  const tonicTriad = diatonicTriads(key)[0];
  if (tonicTriad === undefined) throw new RangeError('key has no tonic triad');
  return {
    id,
    label: tonicTriad.short,
    name: keyTitle(key),
    play: { type: 'phrase', notes: phrase(key, stepKey(levelId, id), end) },
    hint: { type: 'chord', notes: triadNotes(tonicTriad) },
    match: {
      type: 'root',
      note: key.tonic,
      then: { type: 'choice', answer: key.mode, options: ['major', 'minor'] },
    },
    explain: `Home is ${pretty(key.tonic)}, and it's ${key.mode}. ${MODE_EXPLAIN[key.mode]}`,
  };
}

function findTheKeyStage(): Stage {
  return {
    id: 'find-the-key',
    title: 'Find the key',
    blurb:
      'Hear a short phrase. Hunt for its home note on your keyboard, then call it major or minor.',
    unlock: { stage: 'chords-in-key', level: 3 },
    levels: FIND_KEY_LEVELS.map((def, i): Level => {
      const id = `find-the-key-${i + 1}`;
      return {
        id,
        title: `Level ${i + 1}`,
        blurb: def.blurb,
        pass: PASS_FIVE,
        steps: [],
        pool: def.keys.flatMap((key) =>
          Array.from({ length: PHRASES_PER_KEY }, (_, n) => findKeyStep(id, key, n + 1, def.end)),
        ),
      };
    }),
  };
}

// ---------------------------------------------------------------- track

export function earTraining(): Track {
  return {
    id: 'ear-training',
    title: 'Ear training',
    blurb:
      'The app plays, you name it, then you play it back. Five stages, each building on the last — from two notes to a whole key.',
    group: 'Ear training',
    map: 'ladder',
    available: true,
    stages: [
      intervalsStage(),
      scaleDegreesStage(),
      chordQualityStage(),
      chordsInKeyStage(),
      findTheKeyStage(),
    ],
  };
}
