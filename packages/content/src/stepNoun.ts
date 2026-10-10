// What copy calls a practice level's steps ("3 of 7 chords", "Scale 1 of 2"), derived from
// the match types so the engine and renderer never special-case a track id.
import type { Step } from './types';

export type StepNoun = 'chord' | 'scale' | 'progression' | 'step';

/**
 * `chord` / `voicing` steps are chords, `sequence` steps are scales, `progression` steps are
 * progressions; a mix (or anything else) is steps.
 */
export function stepNoun(steps: readonly Pick<Step, 'match'>[]): StepNoun {
  if (steps.length === 0) return 'step';
  if (steps.every((s) => s.match.type === 'chord' || s.match.type === 'voicing')) return 'chord';
  if (steps.every((s) => s.match.type === 'sequence')) return 'scale';
  if (steps.every((s) => s.match.type === 'progression')) return 'progression';
  return 'step';
}

/** "chords" · "scales" · "steps". */
export function stepNounPlural(noun: StepNoun): string {
  return `${noun}s`;
}
