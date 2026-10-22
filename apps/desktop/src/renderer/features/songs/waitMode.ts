// Wait mode (decisions.md 2026-10-21 "Songs from MIDI"): the song stops at each step until the
// learner has struck every key of it — the exact keys, octave and inversion included. A key that
// isn't in the step is shown, never punished; the step simply waits. At the end of the chosen
// bars it starts again.
import type { Midi } from '@cadence/music';
import type { SongStep } from './songModel';

export interface WaitState {
  /** Index of the step being asked for. */
  index: number;
  /** Keys of this step already struck. */
  hit: readonly Midi[];
  /** The last key struck that isn't in this step. */
  wrong: Midi | null;
  /** Times round the chosen bars. */
  loops: number;
}

export const startWait = (): WaitState => ({ index: 0, hit: [], wrong: null, loops: 0 });

/** A key went down. `advanced` says the step was completed (and which one it was). */
export function waitNoteOn(
  steps: readonly SongStep[],
  state: WaitState,
  midi: Midi,
): { state: WaitState; completed: number | null } {
  const step = steps[state.index];
  if (!step) return { state, completed: null };
  if (!step.notes.some((n) => n.midi === midi)) {
    return { state: { ...state, wrong: midi }, completed: null };
  }
  const hit = state.hit.includes(midi) ? state.hit : [...state.hit, midi];
  if (!step.notes.every((n) => hit.includes(n.midi))) {
    return { state: { ...state, hit, wrong: null }, completed: null };
  }
  const next = state.index + 1;
  return {
    state: {
      index: next >= steps.length ? 0 : next,
      hit: [],
      wrong: null,
      loops: next >= steps.length ? state.loops + 1 : state.loops,
    },
    completed: state.index,
  };
}
