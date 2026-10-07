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
import { PRACTICE_RANGE, placeRoot, stackAbove } from './voicing';

export type MatchSpec =
  /** Any octave, any inversion, any doubling: held pitch-class set equals the target. */
  | { type: 'chord'; notes: readonly PitchClass[] }
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
  | { type: 'root'; note: PitchClass; then?: MatchSpec };

export type MatchStatus = 'idle' | 'partial' | 'matched' | 'wrong';

export interface MatchState {
  status: MatchStatus;
  /** sequence: how many target notes have been played in order. */
  index: number;
  /** sequence: the MIDI notes accepted so far (`index` of them), as actually played. */
  played: readonly Midi[];
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
      return { ...state, status: heldStatus(held, target) };
    }
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

export interface Hint {
  /** Spelled note names with ♯/♭, in target order (root, 3rd, 5th for chords). */
  names: string[];
  /** Keys to light: for chords the `placeTriad` voicing. */
  keys: Midi[];
}

/** Derived, never authored (HANDOFF §4): level 1 shows `names`, level 2 lights `keys`. */
export function hintFor(spec: MatchSpec): Hint | null {
  switch (spec.type) {
    case 'chord': {
      const pcs = spec.notes.map(pcNumber);
      const root = pcs[0];
      if (root === undefined) return { names: [], keys: [] };
      return {
        names: spec.notes.map(pretty),
        keys: stackAbove(placeRoot(root), pcs.slice(1)),
      };
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
