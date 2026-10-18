// Find the key (Task 15, EarKey.dc.html): step-card copy, keyboard lighting, answer labels and
// feedback for `root{note, then: choice major/minor}` questions. Pure.
// Copy: EarKey:56–57, 66–67, 73–74, 88, 92–94; the hunting, upcoming and answered states are new
// (docs/tasks/15 Notes).
import {
  hintFor,
  midiToPc,
  noteToMidi,
  pcName,
  pretty,
  type Key,
  type Midi,
  type PitchClass,
} from '@cadence/music';
import type { KeyState } from '../../components/music/PianoKeyboard/PianoKeyboard';
import {
  correctCount,
  rootTryNumber,
  type EarDrillState,
  type EarQuestion,
  type EarResultKind,
  type RootHunt,
} from './earDrillReducer';

/** The question's key (tonic + the major/minor answer), or null for a non-root question. */
export function questionKey(question: EarQuestion | undefined): Key | null {
  const match = question?.match;
  if (match?.type !== 'root') return null;
  const mode = match.then?.type === 'choice' ? match.then.answer : null;
  if (mode !== 'major' && mode !== 'minor') return null;
  return { tonic: match.note, mode };
}

/** The major/minor options of `root.then` (EarKey:92–93). */
export function modeOptions(question: EarQuestion | undefined): string[] {
  const match = question?.match;
  if (match?.type !== 'root' || match.then?.type !== 'choice') return [];
  return [...match.then.options];
}

/** "E major" · "E♭ minor" (EarKey:92–93). */
export function modeLabel(tonic: PitchClass, mode: string): string {
  return `${pretty(tonic)} ${mode}`;
}

/** A tried note's name, spelled in the question's key ("G", "F♯"). */
export function tryName(midi: Midi, key: Key | null): string {
  const pc = midiToPc(midi);
  return pretty(key ? pcName(pc, { key }) : pcName(pc));
}

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
];

export function ordinalWord(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

/** "G" · "G, then A" · "G, A, then B". */
export function triesList(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')}, then ${names[names.length - 1] ?? ''}`;
}

export type StepState = 'done' | 'current' | 'upcoming';

export interface StepCopy {
  state: StepState;
  title: string;
  body: string;
}

/** EarKey:61–68 — step 1 "Find the home note" → "Home note: E" + how many tries it took. */
export function stepOneCopy(root: RootHunt, key: Key | null): StepCopy {
  const names = root.tries.map((m) => tryName(m, key));
  if (!root.found || key === null) {
    const last = names[names.length - 1];
    return {
      state: 'current',
      title: 'Find the home note',
      body:
        last === undefined
          ? 'Play any note. Home is the one the phrase wants to end on.'
          : `Not ${last}. Keep hunting — tries are unlimited.`,
    };
  }
  const n = rootTryNumber(root);
  return {
    state: 'done',
    title: `Home note: ${pretty(key.tonic)}`,
    body:
      n === 1
        ? 'First try.'
        : `Found on your ${ordinalWord(n)} try (you tried ${triesList(names)}).`,
  };
}

/** EarKey:70–75 — step 2 "Major or minor?" with the tip once home is found. */
export function stepTwoCopy(
  root: RootHunt,
  key: Key | null,
  answered: { result: EarResultKind; hinted: boolean } | null,
): StepCopy {
  if (!root.found || key === null) {
    return { state: 'upcoming', title: 'Major or minor?', body: 'Find home first, then decide.' };
  }
  const tonic = pretty(key.tonic);
  if (answered !== null && answered.result !== 'wrong') {
    return {
      state: 'done',
      title: `Key: ${modeLabel(key.tonic, key.mode)}`,
      body:
        answered.result === 'clean'
          ? 'Clean: home in two tries or fewer, no hint.'
          : answered.hinted
            ? 'Counted as hinted: you heard the last chord.'
            : 'Counted as hinted: home took more than two tries.',
    };
  }
  return {
    state: 'current',
    title: 'Major or minor?',
    body: `Tip: play ${tonic} with a major 3rd, then a minor 3rd. Which one matches?`,
  };
}

/**
 * EarKey:104–111 two-octave lighting (engine.md §6.13): home = every octave of the tonic once
 * found (teal); tried = released wrong notes in the octave played (`--sand`). Held notes come
 * from the live MIDI store (priority correct > home > hint > held > tried).
 */
export function keyboardStates(
  question: EarQuestion | undefined,
  root: RootHunt,
): Record<Midi, KeyState> {
  const states: Record<Midi, KeyState> = {};
  for (const m of root.tries) states[m] = 'tried';
  const match = question?.match;
  if (root.found && match?.type === 'root') {
    for (const m of hintFor({ type: 'root', note: match.note })?.keys ?? []) states[m] = 'home';
  }
  return states;
}

/** The answered panel's one-octave keyboard (C4–B4): the tonic triad (`step.hint`) lit teal. */
export function feedbackKeys(question: EarQuestion, startMidi: Midi = 60): Record<Midi, KeyState> {
  const states: Record<Midi, KeyState> = {};
  const hint = question.hint;
  if (hint === undefined || hint.type === 'cadence' || hint.type === 'chords') return states;
  for (const n of hint.notes) states[startMidi + midiToPc(noteToMidi(n))] = 'correct';
  return states;
}

export interface KeyFeedback {
  title: string;
  body: string;
}

/** ui.md §3 EarKey step-2 answered feedback: "E minor — yes." / "Not quite. That was E minor." */
export function keyFeedback(question: EarQuestion, chosen: string, correct: boolean): KeyFeedback {
  const key = questionKey(question);
  const name = key ? modeLabel(key.tonic, key.mode) : question.name;
  const explain = question.explain ?? '';
  return correct
    ? { title: `${name} — yes.`, body: explain }
    : {
        title: `Not quite. That was ${name}.`,
        body: `${explain} You said ${chosen} — it will come back in review.`.trim(),
      };
}

/** EarKey:47 — "1 right · phrase 2 of 5". */
export function keyProgressLabel(state: EarDrillState): string {
  const total = state.questions.length;
  const qNo = Math.min(total, state.q + 1);
  return `${correctCount(state)} right · phrase ${qNo} of ${total}`;
}
