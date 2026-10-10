// engine.md §4 Question selection (ear `sessions.start`), adaptive since 2026-10-02
// (docs/decisions.md "Adaptive ear selection and focus rounds"): due and never-seen steps once
// each, then weak steps weighted by times_wrong, then the rest, and settled steps (interval ≥ 7
// days, last clean) at most once; arranged with no back-to-back repeats and at most two
// consecutive questions sharing an answer (best of N shuffles when that is impossible).
import type { Step } from '@cadence/content';
import { INTERVALS } from '@cadence/music';
import type { StepProgressRow } from './ports';

export type Rng = () => number;

/** mulberry32: small deterministic PRNG in [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash, for seeding the PRNG from a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The answer a question is graded against (used for the run-length rule). */
export function answerOf(step: Step): string {
  const m = step.match;
  switch (m.type) {
    case 'choice':
      return m.answer;
    case 'root':
      return m.then?.type === 'choice' ? `${m.note}:${m.then.answer}` : m.note;
    case 'chord':
      return m.bass === undefined ? m.notes.join(' ') : `${m.notes.join(' ')}/${m.bass}`;
    case 'voicing':
    case 'sequence':
      return m.notes.join(' ');
    case 'progression':
      return m.chords.map((c) => c.notes.join(' ')).join(' | ');
  }
}

// ---------------------------------------------------------------- choosing the multiset

/** Settled = interval ≥ 7 days (interval_index ≥ 2) with a clean last answer. */
export const SETTLED_DAYS = 7;
/** A weak step takes at most this share of a session (never fewer than 2 slots). */
const WEAK_MAX_SHARE = 0.4;

export interface StepBuckets {
  /** due_on ≤ today, earliest first. */
  due: Step[];
  /** No progress row yet, pool order. */
  unseen: Step[];
  /** last_result wrong, or times_wrong > 0 with interval < 7 days; times_wrong desc. */
  weak: Step[];
  /** interval ≥ 7 days and last clean; stalest first. */
  settled: Step[];
  /** Everything else; times_wrong desc, last_seen_at asc. */
  other: Step[];
}

const isWeak = (row: StepProgressRow): boolean =>
  row.lastResult === 'wrong' || (row.timesWrong > 0 && row.intervalDays < SETTLED_DAYS);

const isSettled = (row: StepProgressRow): boolean =>
  row.intervalDays >= SETTLED_DAYS && row.lastResult === 'clean';

/**
 * engine.md §4 Question selection: partition the pool. A due step is listed in `due`; when it
 * is also weak it is listed in `weak` too, so it can earn extra appearances.
 */
export function partition(
  pool: readonly Step[],
  progress: readonly StepProgressRow[],
  today: string,
): StepBuckets {
  const rows = new Map(progress.map((r) => [r.stepId, r]));
  const out: StepBuckets = { due: [], unseen: [], weak: [], settled: [], other: [] };
  for (const step of pool) {
    const r = rows.get(step.id);
    if (!r) out.unseen.push(step);
    else if (r.dueOn !== null && r.dueOn <= today) {
      out.due.push(step);
      if (isWeak(r)) out.weak.push(step);
    } else if (isWeak(r)) out.weak.push(step);
    else if (isSettled(r)) out.settled.push(step);
    else out.other.push(step);
  }
  const by =
    (f: (a: StepProgressRow, b: StepProgressRow) => number) =>
    (a: Step, b: Step): number => {
      const ra = rows.get(a.id);
      const rb = rows.get(b.id);
      return ra && rb ? f(ra, rb) : 0;
    };
  const weakest = by((a, b) => b.timesWrong - a.timesWrong || a.lastSeenAt - b.lastSeenAt);
  out.due.sort(by((a, b) => (a.dueOn ?? '').localeCompare(b.dueOn ?? '')));
  out.weak.sort(weakest);
  out.other.sort(weakest);
  out.settled.sort(by((a, b) => a.lastSeenAt - b.lastSeenAt));
  return out;
}

/**
 * The `count` questions, unordered (engine.md §4 Question selection):
 * 1. due + unseen once each (due first; truncated to `count`);
 * 2. weak: ⌈R × share⌉ appearances each, share = times_wrong / Σ times_wrong and R = slots left
 *    after step 1; at least 2 each when there are ≤ 3 weak steps; at most max(2, ⌊0.4·count⌋);
 * 3. other: once each;
 * 4. settled: once each, only when slots remain;
 * 5. still short (small pools): round-robin over the non-settled steps, weak first, each capped
 *    at the weak cap, then at ⌈count / 2⌉ so the order stays arrangeable; settled steps repeat
 *    only when nothing else can.
 */
export function chooseQuestions(
  pool: readonly Step[],
  progress: readonly StepProgressRow[],
  today: string,
  count: number,
): Step[] {
  if (pool.length === 0 || count <= 0) return [];
  const rows = new Map(progress.map((r) => [r.stepId, r]));
  const b = partition(pool, progress, today);
  const chosen: Step[] = [];
  const times = new Map<string, number>();
  const n = (s: Step): number => times.get(s.id) ?? 0;
  const add = (s: Step): boolean => {
    if (chosen.length >= count) return false;
    chosen.push(s);
    times.set(s.id, n(s) + 1);
    return true;
  };

  for (const s of [...b.due, ...b.unseen]) add(s);

  const remaining = count - chosen.length;
  const wrongs = (s: Step): number => Math.max(1, rows.get(s.id)?.timesWrong ?? 1);
  const weakTotal = b.weak.reduce((sum, s) => sum + wrongs(s), 0);
  const cap = Math.max(2, Math.floor(count * WEAK_MAX_SHARE));
  for (const s of b.weak) {
    let target = Math.ceil((remaining * wrongs(s)) / Math.max(1, weakTotal));
    if (b.weak.length <= 3) target = Math.max(target, 2);
    target = Math.min(target, cap);
    while (n(s) < target && add(s));
  }

  for (const s of b.other) if (n(s) === 0) add(s);
  for (const s of b.settled) add(s);

  const half = Math.ceil(count / 2);
  const seen = new Set<string>();
  const cycle = [...b.weak, ...b.due, ...b.unseen, ...b.other].filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  while (chosen.length < count) {
    let progressed = false;
    for (const s of cycle) if (n(s) < cap && add(s)) progressed = true;
    if (!progressed) for (const s of cycle) if (n(s) < half && add(s)) progressed = true;
    if (!progressed) for (const s of b.settled) if (add(s)) progressed = true;
    if (!progressed) for (const s of cycle) if (add(s)) progressed = true;
    if (!progressed) break;
  }
  return chosen;
}

// ---------------------------------------------------------------- focus rounds

const choiceAnswer = (s: Step): string | null =>
  s.match.type === 'choice' ? s.match.answer : null;

const firstNote = (s: Step): string | null =>
  s.play?.type === 'notes' ? (s.play.notes[0] ?? null) : null;

const SEMITONES: ReadonlyMap<string, number> = new Map(
  INTERVALS.map((iv) => [iv.id as string, iv.semitones]),
);

/**
 * engine.md §4 focus rounds ("Drill what you missed"): the steps whose last answer was wrong or
 * hinted, plus — on interval levels — the same-root steps whose interval is 1 or 2 semitones
 * away among the level's `activeOptions` (P4 ↔ M3/TT/m3/P5), or the nearest active interval when
 * none is that close (P8 ↔ P5 on L3). The whole pool when nothing was missed.
 */
export function focusPool(
  pool: readonly Step[],
  progress: readonly StepProgressRow[],
  activeOptions: readonly string[] | undefined,
): Step[] {
  const rows = new Map(progress.map((r) => [r.stepId, r]));
  const missed = pool.filter((s) => {
    const r = rows.get(s.id)?.lastResult;
    return r === 'wrong' || r === 'hinted';
  });
  if (missed.length === 0) return [...pool];
  const keep = new Set(missed.map((s) => s.id));
  const options = activeOptions ?? [];
  if (options.length > 0 && options.every((o) => SEMITONES.has(o))) {
    for (const m of missed) {
      const answer = choiceAnswer(m);
      const at = answer === null ? undefined : SEMITONES.get(answer);
      if (at === undefined) continue;
      const dist = (o: string): number => Math.abs((SEMITONES.get(o) ?? Number.NaN) - at);
      let near = new Set(options.filter((o) => dist(o) === 1 || dist(o) === 2));
      if (near.size === 0) {
        // Nothing within 2 semitones (P8 on L3): the nearest active interval(s) instead.
        const others = options.filter((o) => dist(o) > 0);
        const min = Math.min(...others.map(dist));
        near = new Set(others.filter((o) => dist(o) === min));
      }
      for (const s of pool) {
        const a = choiceAnswer(s);
        if (a !== null && near.has(a) && firstNote(s) === firstNote(m)) keep.add(s.id);
      }
    }
  }
  return pool.filter((s) => keep.has(s.id));
}

// ---------------------------------------------------------------- ordering

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

const MAX_SAME_ANSWER_RUN = 2;

function fits(out: readonly Step[], next: Step, strict: boolean): boolean {
  const last = out[out.length - 1];
  if (last && last.id === next.id) return false;
  if (!strict) return true;
  const a = answerOf(next);
  let run = 0;
  for (let i = out.length - 1; i >= 0; i--) {
    const s = out[i];
    if (!s || answerOf(s) !== a) break;
    run++;
  }
  return run < MAX_SAME_ANSWER_RUN;
}

/** Violations of the two ordering rules (0 = perfect). */
export function orderViolations(order: readonly Step[]): number {
  let n = 0;
  for (let i = 1; i < order.length; i++) {
    const cur = order[i];
    const prev = order[i - 1];
    if (cur && prev && cur.id === prev.id) n += 10;
    const prev2 = order[i - 2];
    if (cur && prev && prev2) {
      const a = answerOf(cur);
      if (answerOf(prev) === a && answerOf(prev2) === a) n++;
    }
  }
  return n;
}

/**
 * Randomized greedy arrangement, retried until no rule is broken (or the best found). A step
 * that holds more than half of what is left goes next when it fits, so heavily weighted weak
 * steps spread out instead of piling up at the end.
 */
export function arrange(items: readonly Step[], rng: Rng, attempts = 200): Step[] {
  let best: Step[] = [...items];
  let bestScore = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const remaining = shuffle(items, rng);
    const out: Step[] = [];
    while (remaining.length > 0) {
      const left = new Map<string, number>();
      for (const s of remaining) left.set(s.id, (left.get(s.id) ?? 0) + 1);
      let idx = remaining.findIndex(
        (s) => 2 * (left.get(s.id) ?? 0) > remaining.length && fits(out, s, true),
      );
      if (idx < 0) idx = remaining.findIndex((s) => fits(out, s, true));
      if (idx < 0) idx = remaining.findIndex((s) => fits(out, s, false));
      if (idx < 0) idx = 0;
      const [picked] = remaining.splice(idx, 1);
      if (picked) out.push(picked);
    }
    const score = orderViolations(out);
    if (score < bestScore) {
      best = out;
      bestScore = score;
    }
    if (score === 0) break;
  }
  return best;
}

/** Choose and order `count` questions from `pool` (engine.md §4 Question selection). */
export function selectQuestions(
  pool: readonly Step[],
  progress: readonly StepProgressRow[],
  today: string,
  count: number,
  rng: Rng,
): Step[] {
  return arrange(chooseQuestions(pool, progress, today, count), rng);
}
