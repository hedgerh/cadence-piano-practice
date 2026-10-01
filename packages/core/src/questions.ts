// engine.md §4 Question selection (ear `sessions.start`): due pool steps first
// (due_on ≤ today), then never-seen, then by times_wrong desc, last_seen_at asc; take
// `pass.of`, cycling the pool if smaller; shuffle with no back-to-back repeats and at most
// two consecutive questions sharing an answer.
import type { Step } from '@cadence/content';
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
    case 'voicing':
    case 'sequence':
      return m.notes.join(' ');
  }
}

/** Priority order: due (by due_on), never seen (pool order), then weakest/stalest first. */
export function prioritize(
  pool: readonly Step[],
  progress: readonly StepProgressRow[],
  today: string,
): Step[] {
  const rows = new Map(progress.map((r) => [r.stepId, r]));
  const due: Array<{ step: Step; row: StepProgressRow }> = [];
  const unseen: Step[] = [];
  const rest: Array<{ step: Step; row: StepProgressRow }> = [];
  for (const step of pool) {
    const row = rows.get(step.id);
    if (!row) unseen.push(step);
    else if (row.dueOn !== null && row.dueOn <= today) due.push({ step, row });
    else rest.push({ step, row });
  }
  due.sort((a, b) => (a.row.dueOn ?? '').localeCompare(b.row.dueOn ?? ''));
  rest.sort((a, b) => b.row.timesWrong - a.row.timesWrong || a.row.lastSeenAt - b.row.lastSeenAt);
  return [...due.map((d) => d.step), ...unseen, ...rest.map((r) => r.step)];
}

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

/** Randomized greedy arrangement, retried until no rule is broken (or the best found). */
export function arrange(items: readonly Step[], rng: Rng, attempts = 60): Step[] {
  let best: Step[] = [...items];
  let bestScore = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const remaining = shuffle(items, rng);
    const out: Step[] = [];
    while (remaining.length > 0) {
      let idx = remaining.findIndex((s) => fits(out, s, true));
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
  if (pool.length === 0 || count <= 0) return [];
  const ranked = prioritize(pool, progress, today);
  const chosen: Step[] = [];
  for (let i = 0; chosen.length < count; i++) {
    const step = ranked[i % ranked.length];
    if (step) chosen.push(step);
  }
  return arrange(chosen, rng);
}
