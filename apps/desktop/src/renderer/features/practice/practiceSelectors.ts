// Practice.dc.html:153–196 — derivations from PracticeState to what the screen draws.
// Pure (no React) so the reducer tests can cover them.
import type { StepNoun } from '@cadence/content';
import { hintFor, midiToPc, pcNumber, pretty, type Midi, type PitchClass } from '@cadence/music';
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

/** "chord" for chord levels, "scale" for scale levels, "phrase" for echoes…: the wording. */
export function practiceNoun(state: Pick<PracticeState, 'noun'>): StepNoun {
  return state.noun;
}

/**
 * Practice:159–170 + engine.md §5: hint 2 lights the target tangerine; a match flashes teal.
 * A scale lights each note teal as it is accepted, so the run so far stays visible (a wrong
 * note clears it: HANDOFF §5 resets silently). A progression draws the chord just played
 * outlined in teal and a voice that moved too far in lavender (decisions.md 2026-10-10, 2026-10-14).
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

/**
 * Progressions, two-hand work and shapes played in any octave (arpeggios, echoes;
 * decisions.md 2026-10-17) need the three-octave keyboard, for the whole level.
 */
export function keyboardVariant(state: Pick<PracticeState, 'steps'>): KeyboardVariant {
  const roomy = state.steps.some(
    (s) =>
      s.match.type === 'progression' || (s.match.type === 'sequence' && s.match.shape === true),
  );
  return roomy ? 'three-octave' : 'two-octave';
}

/** The three-octave keyboard's two windows: C2..B4 (left-hand bass room) and C3..B5. */
export const THREE_OCTAVE_STARTS: readonly Midi[] = [36, 48];

/**
 * decisions.md 2026-10-12 "Keyboard follows the hand": a smooth path can climb past B4 (after
 * D–G–B the nearest C is E–G–C with C5 on top), so the three-octave keyboard shows whichever
 * window holds every note in play — what is held, the chord just played, the next chord's
 * nearest voicing and a flash — preferring C2..B4; failing that, the one holding the most.
 * Undefined for the two-octave keyboard (its fixed C3..B4).
 */
export function keyboardStart(state: PracticeState): Midi | undefined {
  if (keyboardVariant(state) !== 'three-octave') return undefined;
  const step = currentStep(state);
  const notes = new Set<Midi>([...state.held, ...state.flash]);
  if (state.phase === 'listening' && step) {
    for (const m of state.match.played) notes.add(m);
    for (const m of hintFor(step.match, state.match)?.keys ?? []) notes.add(m);
  }
  const inside = (start: Midi) => [...notes].filter((m) => m >= start && m < start + 36).length;
  let best = THREE_OCTAVE_STARTS[0] ?? 36;
  for (const start of THREE_OCTAVE_STARTS) {
    if (inside(start) === notes.size) return start;
    if (inside(start) > inside(best)) best = start;
  }
  return best;
}

export interface ProgressionPart {
  label: string;
  /** Chord symbol under the numeral ("B♭/D"). */
  sub?: string | undefined;
  state: RomanChipState;
  /**
   * The notes you played for a done chord, low to high ("E G♯ B"; a left-hand bass is set off
   * with a dot: "A · E A C♯"). Undefined until it is played.
   */
  played?: string | undefined;
}

/**
 * A progression step's chord chips: played teal, the one to play tangerine, the rest white.
 * Each played chord keeps the notes you used under it (decisions.md 2026-10-14 "Progression
 * help"), so a rejected move can be retried from where your hand was.
 */
export function progressionParts(state: PracticeState): ProgressionPart[] {
  const step = currentStep(state);
  if (!step?.parts) return [];
  // A sequence with parts (chord tones): one chip per note, lit as each is played.
  if (step.match.type === 'sequence') {
    const done = state.phase === 'listening' ? state.match.index : step.parts.length;
    return step.parts.map((p, i) => ({
      label: p.label,
      sub: p.sub,
      state: i < done ? 'done' : i === done ? 'current' : 'upcoming',
    }));
  }
  if (step.match.type !== 'progression') return [];
  const chords = step.match.chords;
  const done = state.phase === 'listening' ? state.match.index : step.parts.length;
  return step.parts.map((p, i) => {
    const voicing = state.match.history[i];
    const notes = chords[i]?.notes ?? [];
    return {
      label: p.label,
      sub: p.sub,
      state: i < done ? 'done' : i === done ? 'current' : 'upcoming',
      played: voicing === undefined ? undefined : playedNames(voicing, notes),
    };
  });
}

/** `voicing` spelled with the chord's own names; an extra lowest note is a left-hand bass. */
function playedNames(voicing: readonly Midi[], notes: readonly PitchClass[]): string {
  const name = (m: Midi) => pretty(notes.find((n) => pcNumber(n) === midiToPc(m)) ?? '?');
  const names = voicing.map(name);
  if (voicing.length <= notes.length) return names.join(' ');
  const [bass, ...rest] = names;
  return `${bass ?? ''} · ${rest.join(' ')}`;
}

/** True when the right chord was played but a voice moved too far. */
export function movedTooFar(state: PracticeState): boolean {
  return state.phase === 'listening' && state.match.tooFar.length > 0;
}

/**
 * The lavender nudge. Two chords that share no notes (IV → V, V → vi) get the reason
 * (decisions.md 2026-10-14 "Progression help"): every note moves, so the shape slides toward
 * the new root, and the top note carries the line.
 */
export function tooFarCopy(state: PracticeState): string | null {
  if (!movedTooFar(state)) return null;
  const step = currentStep(state);
  const i = state.match.index;
  if (step?.match.type === 'progression' && i > 0) {
    const from = step.match.chords[i - 1];
    const to = step.match.chords[i];
    const shared = to?.notes.some((n) => from?.notes.some((m) => pcNumber(m) === pcNumber(n)));
    const fromRoot = from?.notes[0];
    const toRoot = to?.notes[0];
    if (shared === false && fromRoot !== undefined && toRoot !== undefined) {
      const up = (pcNumber(toRoot) - pcNumber(fromRoot) + 12) % 12 <= 6;
      const a = step.parts?.[i - 1]?.label ?? pretty(fromRoot);
      const b = step.parts?.[i]?.label ?? pretty(toRoot);
      return `**${a}** and **${b}** share no notes, so every note moves: take each one **${up ? 'up' : 'down'}** to the nearest note of ${b}. Listen to the top note.`;
    }
  }
  return 'Right chord, big jump: move the lavender notes less and keep shared notes down.';
}

/** "Start over" shows once a progression step is under way. */
export function canRestart(state: PracticeState): boolean {
  return (
    state.phase === 'listening' &&
    currentStep(state)?.match.type === 'progression' &&
    state.match.index > 0
  );
}

/** The caption under the keyboard, by what the current step asks for. */
export function keyboardCaption(state: PracticeState): string {
  const step = currentStep(state);
  const match = step?.match;
  // decisions.md 2026-10-17 "Melody tracks".
  if (match?.type === 'sequence' && step?.play) {
    return 'Listen, then play it back in any octave. A wrong note starts the phrase again.';
  }
  if (match?.type === 'sequence' && match.shape === true) {
    return 'Up and back down, starting in any octave. A wrong note starts it again.';
  }
  if (match?.type === 'sequence' && step?.parts) {
    return 'One note for each chord, in any octave. A wrong note starts the line again.';
  }
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
 * A circle-run session reads "Circle run · key 6 of 12" (decisions.md 2026-10-11; the header
 * title already names the key), or "Circle run · G major" without a position; toned by kind.
 */
export function eyebrowFor(
  session: Pick<PracticeSession, 'kind' | 'trackTitle'> &
    Partial<Pick<PracticeSession, 'run' | 'levelTitle' | 'keyProgress'>>,
): {
  text: string;
  tone: EyebrowTone;
} {
  const rp = session.keyProgress;
  if (session.run === 'circle' && rp) {
    return {
      text: `Circle run · key ${rp.position} of ${rp.total}`,
      tone: KIND_TONE[session.kind],
    };
  }
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
    if (practiceNoun(state) === 'phrase') {
      return {
        title: `All ${word(total)} by ear. Nice.`,
        body: `You heard ${levelTitle} and played it back.`,
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

export type RunDot = 'done' | 'current' | 'upcoming';

/**
 * decisions.md 2026-10-11 "Key progress": one dot per key of a circle track, this key
 * tangerine. In a circle run the keys before this one are done (a run goes in circle order)
 * and "N keys left" counts the rest of the run; otherwise completed keys are teal and "N keys
 * left" counts the keys not yet completed (this one included).
 */
export function keyProgressView(
  kp: { position: number; total: number; done: readonly boolean[] } | null | undefined,
  run: boolean,
): { dots: RunDot[]; label: string; aria: string } | null {
  if (!kp || kp.total < 1) return null;
  const dots = Array.from({ length: kp.total }, (_, i): RunDot => {
    if (i + 1 === kp.position) return 'current';
    const done = run ? i + 1 < kp.position : kp.done[i] === true;
    return done ? 'done' : 'upcoming';
  });
  const left = run ? kp.total - kp.position : dots.filter((_, i) => kp.done[i] !== true).length;
  const label =
    left === 0
      ? run
        ? 'Last key'
        : 'All keys done'
      : left === 1
        ? '1 key left'
        : `${left} keys left`;
  return { dots, label, aria: `Key ${kp.position} of ${kp.total}, ${label.toLowerCase()}` };
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
