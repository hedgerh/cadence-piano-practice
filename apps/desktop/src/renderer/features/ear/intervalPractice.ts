// Free interval practice (decisions.md 2026-10-11 "Interval practice"): the learner picks which
// intervals and directions to drill; questions are generated here, nothing is recorded. Pure
// apart from the settings' browser storage.
import type { Sound } from '@cadence/content';
import { intervalAnchor, intervalExplain } from '@cadence/content';
import {
  INTERVALS,
  type IntervalId,
  type Midi,
  type Note,
  type Pc,
  midiToNote,
  noteToMidi,
  pretty,
  transpose,
} from '@cadence/music';

export type PracticeDirection = 'up' | 'down' | 'together';
export const DIRECTIONS: readonly PracticeDirection[] = ['up', 'down', 'together'];
export const DIRECTION_LABEL: Readonly<Record<PracticeDirection, string>> = {
  up: 'Up',
  down: 'Down',
  together: 'Together',
};

export interface PracticeSettings {
  intervals: IntervalId[];
  directions: PracticeDirection[];
  /** Pitch classes (0 = C) the intervals start from; C only by default. */
  roots: Pc[];
}

/** Ascending level 2's set, every interval from C: a gentle start. */
export const DEFAULT_SETTINGS: PracticeSettings = {
  intervals: ['P1', 'm3', 'M3', 'P5', 'P8'],
  directions: ['up'],
  roots: [0],
};

export const ALL_ROOTS: readonly Pc[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** "C", "C♯", "E♭" … for the root toggles. */
export const rootLabel = (pc: Pc): string => pretty(midiToNote(60 + pc).replace(/-?\d+$/, ''));

/**
 * Where a question starts: up and together from the root in C4..B4 (C4 = middle C), down from
 * the root an octave higher (C5..B5), as the ladder's C4 / C5.
 */
export function rootNote(pc: Pc, direction: PracticeDirection): Note {
  return midiToNote((direction === 'down' ? 72 : 60) + pc);
}

export interface PracticeQuestion {
  /** Unique per question ("3:up-D4-m3"), so React can tell consecutive questions apart. */
  key: string;
  interval: IntervalId;
  direction: PracticeDirection;
  /** The question's root as a pitch class (0 = C). */
  rootPc: Pc;
  sound: Sound;
  /** "D up to F. 'Greensleeves' — …" (the ladder's feedback sentence). */
  explain: string;
  /** Both notes folded into C4..B4 for the one-octave feedback keyboard. */
  keys: Midi[];
}

const ALL_IDS = new Set<string>(INTERVALS.map((i) => i.id));
const isDirection = (d: unknown): d is PracticeDirection =>
  typeof d === 'string' && (DIRECTIONS as readonly string[]).includes(d);

/** Intervals in INTERVALS order, deduplicated; unknown ids dropped. */
export function normalizeIntervals(ids: readonly string[]): IntervalId[] {
  const wanted = new Set(ids);
  return INTERVALS.filter((i) => wanted.has(i.id)).map((i) => i.id);
}

export function toggleInterval(s: PracticeSettings, id: IntervalId): PracticeSettings {
  const on = s.intervals.includes(id);
  return {
    ...s,
    intervals: normalizeIntervals(on ? s.intervals.filter((x) => x !== id) : [...s.intervals, id]),
  };
}

/** A root toggles, but the last one on stays on. */
export function toggleRoot(s: PracticeSettings, pc: Pc): PracticeSettings {
  const on = s.roots.includes(pc);
  if (on && s.roots.length === 1) return s;
  const next = on ? s.roots.filter((x) => x !== pc) : [...s.roots, pc];
  return { ...s, roots: ALL_ROOTS.filter((x) => next.includes(x)) };
}

/** A direction toggles, but the last one on stays on. */
export function toggleDirection(s: PracticeSettings, d: PracticeDirection): PracticeSettings {
  const on = s.directions.includes(d);
  if (on && s.directions.length === 1) return s;
  const next = on ? s.directions.filter((x) => x !== d) : [...s.directions, d];
  return { ...s, directions: DIRECTIONS.filter((x) => next.includes(x)) };
}

const fold = (m: Midi): Midi => 60 + ((((m - 60) % 12) + 12) % 12);

export function makeQuestion(
  interval: IntervalId,
  direction: PracticeDirection,
  root: Note,
  n = 0,
): PracticeQuestion {
  const iv = INTERVALS.find((i) => i.id === interval);
  if (!iv) throw new RangeError(`unknown interval ${interval}`);
  const other = transpose(root, direction === 'down' ? -iv.semitones : iv.semitones);
  let explain: string;
  if (direction === 'together') {
    const a = pretty(root.replace(/-?\d+$/, ''));
    const b = pretty(other.replace(/-?\d+$/, ''));
    const both = iv.id === 'P1' ? `${a} twice, at once.` : `${a} and ${b} at once.`;
    explain = `${both} Going up: ${intervalAnchor(iv.id, 'up')}`;
  } else {
    explain = intervalExplain(root, other, iv, direction);
  }
  return {
    key: `${n}:${direction}-${root}-${interval}`,
    interval,
    direction,
    rootPc: noteToMidi(root) % 12,
    sound:
      direction === 'together'
        ? { type: 'chord', notes: [root, other] }
        : { type: 'notes', notes: [root, other], gapMs: 800 },
    explain,
    keys: [...new Set([root, other].map((x) => fold(noteToMidi(x))))],
  };
}

/**
 * The next question: an (interval, direction) pair drawn evenly from the settings, never the
 * same pair twice in a row when there is a choice; one of the picked roots (C unless the
 * learner adds more). Null when no interval is picked.
 */
export function nextQuestion(
  settings: PracticeSettings,
  rng: () => number,
  prev: PracticeQuestion | null = null,
  n = 0,
): PracticeQuestion | null {
  const pairs = settings.intervals.flatMap((interval) =>
    settings.directions.map((direction) => ({ interval, direction })),
  );
  if (pairs.length === 0) return null;
  const fresh =
    prev === null || pairs.length === 1
      ? pairs
      : pairs.filter((p) => p.interval !== prev.interval || p.direction !== prev.direction);
  const pick = fresh[Math.floor(rng() * fresh.length)] ?? pairs[0];
  if (!pick) return null;
  const pc = settings.roots[Math.floor(rng() * settings.roots.length)] ?? 0;
  return makeQuestion(pick.interval, pick.direction, rootNote(pc, pick.direction), n);
}

export type Tally = Readonly<Partial<Record<IntervalId, { right: number; total: number }>>>;

export function addToTally(t: Tally, id: IntervalId, right: boolean): Tally {
  const cur = t[id] ?? { right: 0, total: 0 };
  return { ...t, [id]: { right: cur.right + (right ? 1 : 0), total: cur.total + 1 } };
}

export function feedbackFor(
  q: PracticeQuestion,
  chosen: IntervalId,
  correct: boolean,
): { title: string; body: string } {
  const name = INTERVALS.find((i) => i.id === q.interval)?.name ?? q.interval;
  const said = INTERVALS.find((i) => i.id === chosen)?.name ?? chosen;
  const article = /^[AEIO]/i.test(name) ? 'an' : 'a'; // "a unison", "an octave"
  return correct
    ? { title: `${name} — yes.`, body: `${q.explain} Nice ears.` }
    : {
        title: `Not quite. That was ${article} ${name.toLowerCase()}.`,
        body: `${q.explain} You said ${said.toLowerCase()}.`,
      };
}

// ------------------------------------------------------------------ settings storage

export const SETTINGS_KEY = 'cadence.intervalPractice.v1';

/** Parsed and validated settings, or null for missing / malformed data. */
export function parseSettings(raw: string | null): PracticeSettings | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as { intervals?: unknown; directions?: unknown; roots?: unknown };
    const ids = Array.isArray(v.intervals)
      ? v.intervals.filter((x): x is string => typeof x === 'string' && ALL_IDS.has(x))
      : [];
    const dirs = Array.isArray(v.directions) ? v.directions.filter(isDirection) : [];
    if (dirs.length === 0) return null;
    // Saved before roots existed (or none valid): C.
    const saved: unknown[] = Array.isArray(v.roots) ? v.roots : [];
    const roots = ALL_ROOTS.filter((pc) => saved.includes(pc));
    return {
      intervals: normalizeIntervals(ids),
      directions: DIRECTIONS.filter((d) => dirs.includes(d)),
      roots: roots.length > 0 ? roots : [0],
    };
  } catch {
    return null;
  }
}

export function loadSettings(): PracticeSettings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY)) ?? DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: PracticeSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable: settings last for this visit only.
  }
}
