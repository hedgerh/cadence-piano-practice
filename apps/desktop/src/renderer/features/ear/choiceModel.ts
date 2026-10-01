// The step-driven parts of ChoiceDrill (Task 13): per-stage option labels, feedback copy,
// the one-octave keyboard lighting, the play-back match and the prompt sounds. Pure.
// Copy: EarInterval.dc.html:184–191 (intervals); docs/tasks/13 (degrees, quality).
import { DEGREE_NAMES, type Quality, type Sound } from '@cadence/content';
import {
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
import type { EarQuestion } from './earDrillReducer';

/** Which label map / copy templates a level uses, from its stage id (engine.md §2.2). */
export type EarStageKind = 'intervals' | 'degrees' | 'quality' | 'generic';

export function stageKindOf(stageId: string | null | undefined): EarStageKind {
  switch (stageId ?? '') {
    case 'intervals':
      return 'intervals';
    case 'scale-degrees':
      return 'degrees';
    case 'chord-quality':
      return 'quality';
    default:
      // chords-in-key (Task 14) renders with the generic templates until it adds its own.
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

/** EarInterval:120–133 (intervals) · task 13 label maps (degrees, quality). */
export function optionLabel(kind: EarStageKind, option: string): OptionLabel {
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

/** AnswerChip size per stage: interval chips (118×64), wider for the quality words. */
export function chipSize(kind: EarStageKind): 'interval' | 'wide' {
  return kind === 'quality' ? 'wide' : 'interval';
}

/** The prompt's sounding notes. */
export function soundNotes(sound: Sound | undefined): Note[] {
  if (sound === undefined || sound.type === 'cadence') return [];
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
