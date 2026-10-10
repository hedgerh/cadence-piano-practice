// Practice.dc.html:153–196 — derivations from PracticeState to what the screen draws.
// Pure (no React) so the reducer tests can cover them.
import { stepNoun, type StepNoun } from '@cadence/content';
import { hintFor, pretty, type Midi, type PitchClass } from '@cadence/music';
import type { KeyState } from '../../components/music/PianoKeyboard/PianoKeyboard';
import type { KeyboardVariant } from '../../components/music/PianoKeyboard/keyboardLayout';
import type { EyebrowTone } from '../../components/ui/TaskHeader';
import type { RomanChipState } from '../../components/ui/RomanChip';
import type { Segment } from '../../components/ui/SegmentedProgress';
import type { MidiStatus } from '../../midi/MidiInput';
import {
  currentStep,
  skippedOrdinals,
  type PracticeSession,
  type PracticeState,
  type PracticeStep,
} from './practiceReducer';

/** Practice:176–179 — done teal / skipped dashed / current tangerine / upcoming white. */
export function chordStates(state: PracticeState): RomanChipState[] {
  return state.steps.map((_, i) => {
    const r = state.results.find((x) => x.ordinal === i);
    if (r) return r.result === 'skipped' ? 'skipped' : 'done';
    if (state.phase !== 'finished' && i === state.current) return 'current';
    if (state.skippedOnce.includes(i)) return 'skipped';
    return 'upcoming';
  });
}

/** Practice:183–186 — done teal, current tangerine, everything else empty (engine.md §6.4). */
export function progressSegments(state: PracticeState): Segment[] {
  return state.steps.map((_, i) => {
    const r = state.results.find((x) => x.ordinal === i);
    if (r && r.result !== 'skipped') return 'done';
    if (state.phase !== 'finished' && i === state.current) return 'current';
    return 'empty';
  });
}

/** "chord" for chord levels, "scale" for scale levels: picks the screen's wording. */
export function practiceNoun(state: Pick<PracticeState, 'steps'>): StepNoun {
  return stepNoun(state.steps);
}

/**
 * Practice:159–170 + engine.md §5: hint 2 lights the target tangerine; a match flashes teal.
 * A scale lights each note teal as it is accepted, so the run so far stays visible (a wrong
 * note clears it: HANDOFF §5 resets silently). A progression draws the chord just played
 * faintly and a voice that moved too far in lavender (decisions.md 2026-10-10).
 */
export function keyboardStates(state: PracticeState): Record<Midi, KeyState> {
  const out: Record<Midi, KeyState> = {};
  if (state.phase === 'finished') return out;
  const step = currentStep(state);
  if (state.phase === 'listening' && step?.match.type === 'progression') {
    for (const m of state.match.played) out[m] = 'previous';
  }
  if (state.hint >= 2 && step) {
    for (const m of hintFor(step.match, state.match)?.keys ?? []) out[m] = 'hint';
  }
  if (state.phase === 'listening' && step?.match.type === 'sequence') {
    for (const m of state.match.played) out[m] = 'correct';
  }
  if (state.phase === 'listening' && step?.match.type === 'progression') {
    for (const m of state.match.tooFar) out[m] = 'far';
  }
  if (state.phase === 'matched' || state.phase === 'advancing') {
    for (const m of state.flash) out[m] = 'correct';
  }
  return out;
}

/** Hint 1: note names with ♯/♭ (`hintFor(...).names`). */
export function hintNames(state: PracticeState): string[] {
  const step = currentStep(state);
  if (!step || state.phase === 'finished' || state.hint < 1) return [];
  return hintFor(step.match, state.match)?.names ?? [];
}

/** Progressions and two-hand work need the three-octave keyboard, for the whole level. */
export function keyboardVariant(state: Pick<PracticeState, 'steps'>): KeyboardVariant {
  return state.steps.some((s) => s.match.type === 'progression') ? 'three-octave' : 'two-octave';
}

export interface ProgressionPart {
  label: string;
  state: RomanChipState;
}

/** A progression step's chord chips: played teal, the one to play tangerine, the rest white. */
export function progressionParts(state: PracticeState): ProgressionPart[] {
  const step = currentStep(state);
  if (!step?.parts || step.match.type !== 'progression') return [];
  const done = state.phase === 'listening' ? state.match.index : step.parts.length;
  return step.parts.map((p, i) => ({
    label: p.label,
    state: i < done ? 'done' : i === done ? 'current' : 'upcoming',
  }));
}

/** True when the right chord was played but a voice moved too far. */
export function movedTooFar(state: PracticeState): boolean {
  return state.phase === 'listening' && state.match.tooFar.length > 0;
}

/** The caption under the keyboard, by what the current step asks for. */
export function keyboardCaption(state: PracticeState): string {
  const match = currentStep(state)?.match;
  if (match?.type === 'sequence') {
    return 'One note at a time, any octave. Each right note stays lit; a wrong one starts the run again.';
  }
  if (match?.type === 'progression') {
    return match.freeBass === true
      ? 'Left hand: each root, low. Right hand: keep shared notes down, step to the rest.'
      : 'Keep shared notes down and step to the rest. Your last chord stays outlined.';
  }
  if (match?.type === 'chord' && match.bass !== undefined) {
    return 'Any octave — just put the right note at the bottom.';
  }
  return 'Keys light up as you play. Hints light up the target.';
}

const QUALITY_SUFFIX = { major: '', minor: 'm', diminished: '°' } as const;

/** Practice:140–146 `short`: "A", "Bm", "C♯m", "G♯°" (falls back to the step label). */
export function chordShort(step: PracticeStep): string {
  const root: PitchClass | undefined =
    step.match.type === 'chord' ? step.match.notes[0] : undefined;
  if (root === undefined || step.quality === undefined) return step.label;
  return `${pretty(root)}${QUALITY_SUFFIX[step.quality]}`;
}

const KIND_LABEL: Record<PracticeSession['kind'], string> = {
  learn: 'Learn',
  review: 'Review',
  warmup: 'Warm-up',
  free: 'Free play',
};

const KIND_TONE: Record<PracticeSession['kind'], EyebrowTone> = {
  learn: 'tangerine',
  review: 'lavender',
  warmup: 'teal',
  free: 'teal',
};

/**
 * Practice:29 "Learn · diatonic chords" — kind + the track title without its Major/Minor prefix.
 * A circle-run session reads "Circle run · G major" (decisions.md 2026-10-03), toned by kind.
 */
export function eyebrowFor(
  session: Pick<PracticeSession, 'kind' | 'trackTitle'> &
    Partial<Pick<PracticeSession, 'run' | 'levelTitle'>>,
): {
  text: string;
  tone: EyebrowTone;
} {
  if (session.run === 'circle' && session.levelTitle !== undefined) {
    return { text: `Circle run · ${session.levelTitle}`, tone: KIND_TONE[session.kind] };
  }
  const topic = session.trackTitle.replace(/^(Major|Minor) /, '');
  const lower = topic.charAt(0).toLowerCase() + topic.slice(1);
  return { text: `${KIND_LABEL[session.kind]} · ${lower}`, tone: KIND_TONE[session.kind] };
}

const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];
const word = (n: number): string => WORDS[n] ?? String(n);
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
}

/**
 * Practice:80–81 "All seven. Nice." / "A major is in your hands now."; ui.md §3: the copy
 * adapts to skips ("Five of seven. Nice." / "G♯° and B° come back tomorrow."). A scale level
 * reads "Up and down. Nice." / "The A minor scale is in your hands now."
 */
export function finishCopy(
  state: PracticeState,
  levelTitle: string,
): { title: string; body: string } {
  const total = state.steps.length;
  const skipped = skippedOrdinals(state);
  if (skipped.length === 0) {
    if (practiceNoun(state) === 'scale') {
      const run = joinNames(state.steps.map((s) => s.label.toLowerCase()));
      return {
        title: `${capital(run)}. Nice.`,
        body: `The ${levelTitle} scale is in your hands now.`,
      };
    }
    return { title: `All ${word(total)}. Nice.`, body: `${levelTitle} is in your hands now.` };
  }
  const names = skipped.map((o) => {
    const step = state.steps[o];
    return step ? chordShort(step) : '';
  });
  return {
    title: `${capital(word(total - skipped.length))} of ${word(total)}. Nice.`,
    body: `${joinNames(names)} ${skipped.length === 1 ? 'comes' : 'come'} back tomorrow.`,
  };
}

export type MarkPlayedMode = 'hidden' | 'text' | 'promoted';

/**
 * engine.md §6.3 + ui.md §3: hidden while a device is connected (unless
 * `showMarkPlayedAlways`, then the Practice:112 text link); with no usable keyboard it is
 * promoted to an OutlineInkButton.
 */
export function markPlayedMode(status: MidiStatus, showAlways: boolean): MarkPlayedMode {
  if (status.kind === 'connected') return showAlways ? 'text' : 'hidden';
  if (status.kind === 'requesting') return 'text';
  return 'promoted';
}
