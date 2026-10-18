// The step-driven parts of ChoiceDrill (Task 13): per-stage option labels, feedback copy,
// the one-octave keyboard lighting, the play-back match and the prompt sounds. Pure.
// Copy: EarInterval.dc.html:184–191 (intervals); docs/tasks/13 (degrees, quality);
// EarChord.dc.html:59–92 (chords in a key, Task 14).
import { DEGREE_NAMES, PROGRESSION_NICKNAMES, type Quality, type Sound } from '@cadence/content';
import {
  diatonicTriads,
  INTERVALS,
  keyTitle,
  midiToPc,
  noteToMidi,
  pretty,
  type MatchSpec,
  type Midi,
  type Note,
  type PitchClass,
} from '@cadence/music';
import type { ChannelOutput } from '@shared/ipc/contracts';
import type { EarQuestion } from './earDrillReducer';

/** Which label map / copy templates a level uses, from its stage id (engine.md §2.2). */
export type EarStageKind =
  'intervals' | 'degrees' | 'quality' | 'numerals' | 'progressions' | 'generic';

/** A track's "Show me" setting (`track_settings.visibility`). */
export type Visibility = ChannelOutput<'tracks.overview'>['visibility'];

export function stageKindOf(stageId: string | null | undefined): EarStageKind {
  switch (stageId ?? '') {
    case 'intervals':
      return 'intervals';
    case 'scale-degrees':
      return 'degrees';
    case 'chord-quality':
      return 'quality';
    case 'chords-in-key':
      return 'numerals';
    case 'progressions':
      return 'progressions';
    default:
      return 'generic';
  }
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const pcOf = (note: Note): string => note.replace(/-?\d+$/, '');
/** "a perfect 4th" · "an octave" · "a unison" (said "yoo"). */
const article = (word: string): string => (/^[aeio]/i.test(word) ? 'an' : 'a');

export interface OptionLabel {
  primary: string;
  secondary: string;
}

/** Per-question context for labels that depend on the key or the track setting. */
export interface LabelContext {
  /** The question on screen (its cadence key names the numeral chips). */
  question?: EarQuestion | undefined;
  /** The ear track's Show-me setting; `num` hides the chord names. */
  visibility?: Visibility | undefined;
}

/**
 * Chords in a key: the diatonic triad's short name for `numeral` in the question's cadence
 * key ("IV" in G major → "C", "vii°" → "F♯°"). Empty without a cadence key.
 */
export function chordShort(question: EarQuestion | undefined, numeral: string): string {
  const ctx = question?.context;
  if (ctx?.type !== 'cadence') return '';
  const triad = diatonicTriads({ tonic: ctx.key, mode: ctx.mode }).find(
    (t) => t.numeral === numeral,
  );
  return triad?.short ?? '';
}

/** EarChord:83 — chord names show unless the ear track is set to numerals only. */
export function chordNamesShown(visibility: Visibility | undefined): boolean {
  return visibility !== 'num';
}

/** EarChord:83 — the line under the numeral chips (numerals-only wording is new copy). */
export function numeralsCaption(visibility: Visibility | undefined): string {
  return chordNamesShown(visibility)
    ? 'Chord names shown — switch to numerals only in Show me, like in practice.'
    : 'Numerals only — switch chord names back on in Show me, like in practice.';
}

/**
 * EarInterval:120–133 (intervals) · task 13 label maps (degrees, quality) · EarChord:75–81
 * (numerals: the numeral over the chord's short name, hidden when visibility is `num`).
 */
export function optionLabel(
  kind: EarStageKind,
  option: string,
  ctx: LabelContext = {},
): OptionLabel {
  switch (kind) {
    case 'intervals': {
      const iv = INTERVALS.find((i) => i.id === option);
      return { primary: option, secondary: iv?.name ?? '' };
    }
    case 'degrees': {
      const name = DEGREE_NAMES[Number(option) - 1];
      return { primary: option, secondary: name ?? '' };
    }
    case 'quality':
      return { primary: capital(option), secondary: QUALITY_SHAPE[option] ?? '' };
    case 'numerals':
      return {
        primary: option,
        secondary: chordNamesShown(ctx.visibility) ? chordShort(ctx.question, option) : '',
      };
    case 'progressions':
      return { primary: option, secondary: PROGRESSION_NICKNAMES[option] ?? '' };
    case 'generic':
      return { primary: option, secondary: '' };
  }
}

/** Second chip line for chord quality: the stacked 3rds (content QUALITY_EXPLAIN in short). */
const QUALITY_SHAPE: Readonly<Record<string, string>> = {
  major: 'M3 + m3',
  minor: 'm3 + M3',
  diminished: 'm3 + m3',
};

/**
 * AnswerChip size per stage: interval chips (118×64), wider for the quality words, the
 * EarChord numeral chips (104×68, EarChord:75).
 */
export function chipSize(kind: EarStageKind): 'interval' | 'wide' | 'chord' {
  if (kind === 'quality' || kind === 'progressions') return 'wide';
  if (kind === 'numerals') return 'chord';
  return 'interval';
}

/** FeedbackPanel text column min-width: EarChord:87 (280) · EarInterval:73 (260). */
export function feedbackMinWidth(kind: EarStageKind): 260 | 280 {
  return kind === 'numerals' ? 280 : 260;
}

/** The prompt's sounding notes. */
export function soundNotes(sound: Sound | undefined): Note[] {
  if (sound === undefined || sound.type === 'cadence') return [];
  // A progression lights its last chord (decisions.md 2026-10-18 "Name the progression").
  if (sound.type === 'chords') return [...(sound.chords[sound.chords.length - 1] ?? [])];
  return [...sound.notes];
}

/** "C then F" (intervals) · "E" (one note) · "C · E♭ · G" (chords). */
export function playbackText(question: EarQuestion): string {
  const sound = question.play;
  const names = soundNotes(sound).map((n) => pretty(pcOf(n)));
  if (sound?.type === 'notes') return names.join(' then ');
  return names.join(' · ');
}

/**
 * engine.md §5 play-back detection: `notes` sounds → ordered `sequence` in any octave (a single
 * prompt note is a one-note sequence); `chord` sounds → the pitch-class set (`chord`). Cadences
 * and phrases are not offered (§6.11).
 */
export function playbackSpec(question: EarQuestion): MatchSpec | null {
  const sound = question.play;
  if (sound === undefined) return null;
  switch (sound.type) {
    case 'notes':
      return sound.notes.length > 0
        ? { type: 'sequence', notes: [...sound.notes], anyOctave: true }
        : null;
    case 'chord':
      return { type: 'chord', notes: sound.notes.map((n) => pcOf(n) as PitchClass) };
    case 'cadence':
    case 'phrase':
    case 'chords':
      return null;
  }
}

/**
 * EarInterval:168 — the sounding notes lit teal on the one-octave keyboard (C4–B4): each note
 * folds to its pitch class in that octave (the octave in P8 lights C once, as designed).
 */
export function litKeys(question: EarQuestion, startMidi: Midi = 60): Midi[] {
  const lit = new Set<Midi>();
  for (const n of soundNotes(question.play)) lit.add(startMidi + midiToPc(noteToMidi(n)));
  return [...lit].sort((a, b) => a - b);
}

/** The cadence key of a question ("C major"), when it has one. */
export function contextKeyTitle(question: EarQuestion | undefined): string | null {
  const ctx = question?.context;
  if (ctx?.type !== 'cadence') return null;
  return keyTitle({ tonic: ctx.key, mode: ctx.mode });
}

/** Identity of a context sound, so the cadence auto-plays once per key (Task 13 acceptance). */
export function contextId(question: EarQuestion | undefined): string | null {
  const ctx = question?.context;
  if (ctx === undefined) return null;
  return JSON.stringify(ctx);
}

/**
 * What an auto-play sounds: the cadence first when the question's key has not been heard yet
 * in this drill, then the prompt. Answers stay disabled until all of it has finished.
 */
export function autoPlaySounds(question: EarQuestion, heardContexts: ReadonlySet<string>): Sound[] {
  const sounds: Sound[] = [];
  const id = contextId(question);
  if (question.context !== undefined && id !== null && !heardContexts.has(id)) {
    sounds.push(question.context);
  }
  if (question.play !== undefined) sounds.push(question.play);
  return sounds;
}

export interface FeedbackCopy {
  title: string;
  body: string;
}

const REVIEW = 'it will come back in review.';

/** First sentence of an explain string ("C minor: C · E♭ · G."). */
const firstSentence = (s: string): string => {
  const cut = s.indexOf('. ');
  return cut >= 0 ? s.slice(0, cut + 1) : s;
};

/**
 * Feedback panel copy. Intervals: EarInterval:189–190. Degrees and quality: docs/tasks/13.
 * `chosen` is the picked option id.
 */
export function feedbackCopy(
  kind: EarStageKind,
  question: EarQuestion,
  chosen: string,
  correct: boolean,
): FeedbackCopy {
  const answer = question.match.type === 'choice' ? question.match.answer : question.label;
  const explain = question.explain ?? '';
  switch (kind) {
    case 'intervals': {
      const target = optionLabel(kind, answer).secondary;
      const said = optionLabel(kind, chosen).secondary.toLowerCase();
      return correct
        ? { title: `${target} — yes.`, body: `${explain} Nice ears.`.trim() }
        : {
            title: `Not quite. That was ${article(target)} ${target.toLowerCase()}.`,
            body: `${explain} You said ${said} — ${REVIEW}`.trim(),
          };
    }
    case 'degrees': {
      const note = soundNotes(question.play)[0];
      const key = contextKeyTitle(question);
      const where =
        note !== undefined && key !== null ? `That's ${pretty(pcOf(note))} in ${key}.` : explain;
      const name = (optionLabel(kind, answer).secondary || '').toLowerCase();
      const saidName = (optionLabel(kind, chosen).secondary || '').toLowerCase();
      return correct
        ? { title: `${answer} — yes.`, body: where }
        : {
            title: `Not quite. That was ${answer}, the ${name}.`,
            body: `${where} You said ${chosen}, the ${saidName} — ${REVIEW}`,
          };
    }
    case 'quality': {
      const notes = firstSentence(explain);
      return correct
        ? { title: `${capital(answer)} — yes.`, body: explain }
        : {
            title: `Not quite. That was ${article(answer)} ${answer} chord.`,
            body: `${notes} You said ${chosen} — ${REVIEW}`.trim(),
          };
    }
    case 'numerals': {
      // EarChord:88–89. The step's `name` is the full chord name ("C major").
      const name = question.name;
      return correct
        ? { title: `${pretty(answer)} — yes, that's ${name}.`, body: explain }
        : {
            title: `Not quite. That was ${pretty(answer)} — ${name}.`,
            body: `${explain} You said ${pretty(chosen)} — ${REVIEW}`.trim(),
          };
    }
    case 'progressions': {
      // decisions.md 2026-10-18 "Name the progression": `explain` spells the chords in the key.
      return correct
        ? { title: `${answer} — yes.`, body: explain }
        : {
            title: `Not quite. That was ${answer}.`,
            body: `${explain} You said ${chosen} — ${REVIEW}`.trim(),
          };
    }
    case 'generic':
      return correct
        ? { title: `${pretty(answer)} — yes.`, body: explain }
        : {
            title: `Not quite. That was ${pretty(answer)}.`,
            body: `${explain} You said ${pretty(chosen)} — ${REVIEW}`.trim(),
          };
  }
}

/** The chip fill once answered: chord quality colors the correct chip by `qualityColor`. */
export function answeredQuality(kind: EarStageKind, option: string): Quality | null {
  if (kind !== 'quality') return null;
  return option === 'major' || option === 'minor' || option === 'diminished' ? option : null;
}

/** TaskHeader eyebrow of a focus round ("Drill what you missed", engine.md §4 focus rounds). */
export const FOCUS_EYEBROW = 'Focus · the ones you missed';

/** The drill eyebrow: the focus line for a focus round, else the stage's own. */
export function drillEyebrow(focus: string | null, stageEyebrow: string): string {
  return focus !== null ? FOCUS_EYEBROW : stageEyebrow;
}

export interface StageCopy {
  /** TaskHeader eyebrow (EarInterval:29 "Name it, then play it back"; EarChord:29 key). */
  eyebrow: string;
  /** PlayButton label before / after the first play (EarInterval:184). */
  play: string;
  playAgain: string;
  /** PlayButton aria-label (EarInterval:51 "Play the interval"; EarChord:59 "Hear the chord"). */
  playAria: string;
  /** Line under the play label (EarInterval:55). */
  prompt: string;
  /** EarInterval:68 — shown while listening when some options are greyed out. */
  greyed: string;
}

/** Intervals: up from C at L1–L4, other roots at L5, down at L6 (engine.md §2.2). */
function intervalPrompt(questions: readonly EarQuestion[]): string {
  const first = (q: EarQuestion) => soundNotes(q.play);
  const down = questions.some((q) => {
    const [a, b] = first(q);
    return a !== undefined && b !== undefined && noteToMidi(b) < noteToMidi(a);
  });
  const dir = down ? 'going down' : 'going up';
  const roots = new Set(questions.map((q) => first(q)[0]).filter((n) => n !== undefined));
  const [only] = [...roots];
  if (roots.size === 1 && only !== undefined) {
    return `Two notes, ${dir}. The first one is always ${pretty(pcOf(only))}.`;
  }
  return `Two notes, ${dir}.`;
}

export function stageCopy(
  kind: EarStageKind,
  questions: readonly EarQuestion[],
  current: EarQuestion | undefined,
): StageCopy {
  switch (kind) {
    case 'intervals':
      return {
        eyebrow: 'Name it, then play it back',
        play: 'Play',
        playAgain: 'Hear it again',
        playAria: 'Play the interval',
        prompt: intervalPrompt(questions),
        greyed: 'Greyed-out intervals arrive in later levels.',
      };
    case 'degrees': {
      const key = contextKeyTitle(current);
      return {
        eyebrow: key !== null ? `Key of ${key}` : 'Name the degree',
        play: 'Play the note',
        playAgain: 'Hear the note again',
        playAria: 'Play the note',
        prompt: 'One note in the key. Which degree is it?',
        greyed: 'Greyed-out degrees arrive in later levels.',
      };
    }
    case 'quality':
      return {
        eyebrow: 'Name it, then play it back',
        play: 'Play the chord',
        playAgain: 'Hear the chord again',
        playAria: 'Hear the chord',
        prompt: 'One chord on its own. Major, minor or diminished?',
        greyed: 'Greyed-out qualities arrive in later levels.',
      };
    case 'numerals': {
      // EarChord:29, 59–73.
      const key = contextKeyTitle(current);
      return {
        eyebrow: key !== null ? `Key of ${key}` : 'Name the chord',
        play: 'Hear the chord',
        playAgain: 'Hear the chord again',
        playAria: 'Hear the chord',
        prompt: 'Which chord did you hear?',
        greyed: 'Greyed-out chords arrive in later levels.',
      };
    }
    case 'progressions': {
      const key = contextKeyTitle(current);
      return {
        eyebrow: key !== null ? `Key of ${key}` : 'Name the progression',
        play: 'Hear the chords',
        playAgain: 'Hear the chords again',
        playAria: 'Hear the progression',
        prompt: 'A few chords in the key. Which progression is it?',
        greyed: 'Greyed-out progressions arrive in later levels.',
      };
    }
    case 'generic': {
      const key = contextKeyTitle(current);
      return {
        eyebrow: key !== null ? `Key of ${key}` : 'Name it, then play it back',
        play: 'Play',
        playAgain: 'Hear it again',
        playAria: 'Play the sound',
        prompt: 'Which one did you hear?',
        greyed: 'Greyed-out answers arrive in later levels.',
      };
    }
  }
}
