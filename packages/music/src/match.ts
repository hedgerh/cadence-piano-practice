// engine.md §1 match.ts — HANDOFF §4 Match union and §5 MIDI matching rules.
// Everything is converted to MIDI numbers / integer pitch classes, so spelling never
// affects grading. Reducers are pure: (spec, state, input) → state.
import {
  type Midi,
  type Note,
  type PitchClass,
  midiToPc,
  noteToMidi,
  pcNumber,
  pretty,
} from './pitch';
import { type ChordTarget, nextVoicing, placeChord, voiceLead, voiceMotion } from './voiceLeading';
import { PRACTICE_RANGE } from './voicing';

/** One chord of a `progression`. */
export interface ProgressionChord {
  notes: readonly PitchClass[];
  /** This chord tone must be the lowest note (an inversion, or the left-hand bass). */
  bass?: PitchClass;
}

export type MatchSpec =
  /**
   * Any octave, any doubling: held pitch-class set equals the target. With `bass`, that chord
   * tone must also be the lowest held note (a named inversion, in any octave).
   */
  | { type: 'chord'; notes: readonly PitchClass[]; bass?: PitchClass }
  /** Exact notes (inversions / voice leading): held MIDI set equals the target. */
  | { type: 'voicing'; notes: readonly Note[] }
  /** Ordered note-ons (scales, ear play-backs). A wrong note resets silently. */
  | {
      type: 'sequence';
      notes: readonly Note[];
      /**
       * With `anyOctave`, each note after the first must also be higher (`up`) or lower (`down`)
       * than the one before, so a scale is played as a run in whatever octave you like.
       */
      direction?: 'up' | 'down';
      /** Accept each note in any octave (ear play-backs, scales). */
      anyOctave?: boolean;
    }
  /** Name it from a list. */
  | { type: 'choice'; answer: string; options: readonly string[] }
  /** Find the key: hit the tonic in any octave, then (optionally) answer `then`. */
  | { type: 'root'; note: PitchClass; then?: MatchSpec }
  /**
   * Chords in order, held one after another (common tones may stay down; letting go is fine).
   * Each must have exactly its notes (one voice per note) and its `bass` lowest. With `maxMove`,
   * every voice may move at most that many semitones from the voicing the learner actually
   * played before it. With `freeBass`, the lowest note is an extra left-hand bass (the chord's
   * `bass`): it may jump, and only the notes above it are measured.
   */
  | {
      type: 'progression';
      chords: readonly ProgressionChord[];
      maxMove?: number;
      freeBass?: boolean;
    };

export type MatchStatus = 'idle' | 'partial' | 'matched' | 'wrong';

export interface MatchState {
  status: MatchStatus;
  /** sequence: how many target notes have been played in order; progression: chords done. */
  index: number;
  /**
   * sequence: the MIDI notes accepted so far (`index` of them), as actually played.
   * progression: the last accepted voicing, ascending.
   */
  played: readonly Midi[];
  /** progression: the right chord, but these held keys moved more than `maxMove`. */
  tooFar: readonly Midi[];
  /** root: MIDI notes played before the tonic was found. */
  tries: readonly Midi[];
  /** root: the tonic has been hit. */
  found: boolean;
  /** root: state of the chained `then` match once the tonic is found. */
  then: MatchState | null;
  /** choice: the option picked. */
  chosen: string | null;
}

export type MatchInput =
  | { type: 'held'; held: ReadonlySet<Midi> }
  | { type: 'noteOn'; midi: Midi }
  | { type: 'choose'; option: string };

export function initialMatchState(_spec: MatchSpec): MatchState {
  return {
    status: 'idle',
    index: 0,
    played: [],
    tooFar: [],
    tries: [],
    found: false,
    then: null,
    chosen: null,
  };
}

function setEquals<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function isSubset<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function heldStatus<T>(held: ReadonlySet<T>, target: ReadonlySet<T>): MatchStatus {
  if (held.size === 0) return 'idle';
  if (setEquals(held, target)) return 'matched';
  if (isSubset(held, target)) return 'partial';
  return 'wrong';
}

export function reduceMatch(spec: MatchSpec, state: MatchState, input: MatchInput): MatchState {
  switch (spec.type) {
    case 'chord': {
      if (input.type !== 'held') return state;
      const held = new Set([...input.held].map(midiToPc));
      const target = new Set(spec.notes.map(pcNumber));
      const status = heldStatus(held, target);
      if (status !== 'matched' || spec.bass === undefined) return { ...state, status };
      const lowest = Math.min(...input.held);
      return { ...state, status: midiToPc(lowest) === pcNumber(spec.bass) ? 'matched' : 'wrong' };
    }
    case 'progression':
      return reduceProgression(spec, state, input);
    case 'voicing': {
      if (input.type !== 'held') return state;
      const target = new Set(spec.notes.map(noteToMidi));
      return { ...state, status: heldStatus(input.held, target) };
    }
    case 'sequence': {
      if (input.type !== 'noteOn' || state.status === 'matched') return state;
      const midi = input.midi;
      const same = (target: Note): boolean =>
        spec.anyOctave === true
          ? midiToPc(noteToMidi(target)) === midiToPc(midi)
          : noteToMidi(target) === midi;
      const prev = state.played[state.played.length - 1];
      const onward =
        spec.anyOctave !== true ||
        spec.direction === undefined ||
        prev === undefined ||
        (spec.direction === 'up' ? midi > prev : midi < prev);
      const expected = spec.notes[state.index];
      const first = spec.notes[0];
      if (expected === undefined || first === undefined) return state;
      let played: Midi[];
      if (onward && same(expected)) played = [...state.played, midi];
      else if (same(first))
        played = [midi]; // HANDOFF §5: wrong note resets silently
      else played = [];
      const index = played.length;
      const status: MatchStatus =
        index === 0 ? 'idle' : index >= spec.notes.length ? 'matched' : 'partial';
      return { ...state, index, played, status };
    }
    case 'root': {
      if (state.status === 'matched') return state;
      if (!state.found) {
        if (input.type !== 'noteOn') return state;
        if (midiToPc(input.midi) !== pcNumber(spec.note)) {
          return { ...state, status: 'wrong', tries: [...state.tries, input.midi] };
        }
        if (spec.then === undefined) return { ...state, found: true, status: 'matched' };
        return { ...state, found: true, status: 'partial', then: initialMatchState(spec.then) };
      }
      if (spec.then === undefined) return state;
      const then = reduceMatch(spec.then, state.then ?? initialMatchState(spec.then), input);
      const status: MatchStatus =
        then.status === 'matched' ? 'matched' : then.status === 'wrong' ? 'wrong' : 'partial';
      return { ...state, then, status };
    }
    case 'choice': {
      if (input.type !== 'choose' || state.status === 'matched') return state;
      return {
        ...state,
        chosen: input.option,
        status: input.option === spec.answer ? 'matched' : 'wrong',
      };
    }
  }
}

function reduceProgression(
  spec: Extract<MatchSpec, { type: 'progression' }>,
  state: MatchState,
  input: MatchInput,
): MatchState {
  if (input.type !== 'held' || state.status === 'matched') return state;
  const held = [...input.held].sort((a, b) => a - b);
  if (held.length === 0) {
    return { ...state, status: state.index === 0 ? 'idle' : 'partial', tooFar: [] };
  }
  const chord = spec.chords[state.index];
  if (chord === undefined) return state;
  const freeBass = spec.freeBass === true;
  const upper = freeBass ? held.slice(1) : held;
  const target = new Set(chord.notes.map(pcNumber));
  const lowest = held[0] ?? 0;
  const shapeOk =
    (!freeBass || held.length >= 2) &&
    upper.length === target.size &&
    setEquals(new Set(upper.map(midiToPc)), target) &&
    (chord.bass === undefined || midiToPc(lowest) === pcNumber(chord.bass));
  if (!shapeOk) {
    // Mid-change (lifting old notes, adding new ones) is not a miss.
    const previous = spec.chords[state.index - 1]?.notes ?? [];
    const allowed = new Set([...target, ...previous.map(pcNumber)]);
    const passing = held.every((m) => allowed.has(midiToPc(m)));
    return { ...state, status: passing ? 'partial' : 'wrong', tooFar: [] };
  }
  if (state.index > 0 && spec.maxMove !== undefined) {
    const before = freeBass ? state.played.slice(1) : state.played;
    const moves = voiceMotion(before, upper);
    const limit = spec.maxMove;
    const tooFar = moves === null ? [] : upper.filter((_, i) => Math.abs(moves[i] ?? 0) > limit);
    if (tooFar.length > 0) return { ...state, status: 'wrong', tooFar };
  }
  const index = state.index + 1;
  return {
    ...state,
    index,
    played: held,
    tooFar: [],
    status: index >= spec.chords.length ? 'matched' : 'partial',
  };
}

const targetOf = (chord: ProgressionChord): ChordTarget =>
  chord.bass === undefined
    ? { pcs: chord.notes.map(pcNumber) }
    : { pcs: chord.notes.map(pcNumber), bass: pcNumber(chord.bass) };

/** `notes` rotated so `bass` comes first. */
function bassFirst(notes: readonly PitchClass[], bass?: PitchClass): PitchClass[] {
  const i = bass === undefined ? 0 : notes.findIndex((n) => pcNumber(n) === pcNumber(bass));
  return i <= 0 ? [...notes] : [...notes.slice(i), ...notes.slice(0, i)];
}

/**
 * The voice-led path a `progression` step demonstrates (play-backs, the first hint): the first
 * chord placed like a hint, each next one the smoothest, kept on the keyboard.
 */
export function progressionPath(spec: Extract<MatchSpec, { type: 'progression' }>): Midi[][] {
  return voiceLead(spec.chords.map(targetOf), spec.freeBass === true);
}

export interface Hint {
  /** Spelled note names with ♯/♭, in target order (root, 3rd, 5th for chords). */
  names: string[];
  /** Keys to light: for chords the `placeTriad` voicing. */
  keys: Midi[];
}

/**
 * Derived, never authored (HANDOFF §4): level 1 shows `names`, level 2 lights `keys`.
 * A progression's hint follows `state`: the next chord, voiced nearest to what was just played.
 */
export function hintFor(spec: MatchSpec, state?: MatchState): Hint | null {
  switch (spec.type) {
    case 'chord': {
      if (spec.notes.length === 0) return { names: [], keys: [] };
      return {
        names: bassFirst(spec.notes, spec.bass).map(pretty),
        keys: placeChord(targetOf(spec)),
      };
    }
    case 'progression': {
      const i = Math.min(state?.index ?? 0, spec.chords.length - 1);
      const chord = spec.chords[i];
      if (chord === undefined) return { names: [], keys: [] };
      const played = state?.played ?? [];
      const freeBass = spec.freeBass === true;
      const keys =
        i === 0 || played.length === 0
          ? (progressionPath(spec)[i] ?? [])
          : nextVoicing(played, targetOf(chord), freeBass);
      const names = freeBass ? chord.notes : bassFirst(chord.notes, chord.bass);
      return { names: names.map(pretty), keys };
    }
    case 'voicing':
    case 'sequence':
      return {
        names: spec.notes.map((n) => pretty(n.replace(/-?\d+$/, ''))),
        keys: spec.notes.map(noteToMidi),
      };
    case 'root': {
      const pc = pcNumber(spec.note);
      const keys: Midi[] = [];
      for (let m = PRACTICE_RANGE.low; m <= PRACTICE_RANGE.high; m++) {
        if (midiToPc(m) === pc) keys.push(m);
      }
      return { names: [pretty(spec.note)], keys };
    }
    case 'choice':
      return null;
  }
}
