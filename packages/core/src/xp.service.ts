// HANDOFF §5 XP, refined by engine.md §4 XpService and §6.2: 5 XP per step for
// clean/hinted/marked (and correct ear answers), 0 for skipped/wrong; 40 per finished chord
// level or passed ear level; 5 per verified ear play-back, once per question.
import { type ServiceContext, todayOf } from './context';
import type { StepResult, XpLedgerRow, XpReason } from './ports';

export const STEP_XP = 5;
export const LEVEL_XP = 40;
export const PLAYBACK_XP = 5;

export function stepXp(result: StepResult): number {
  return result === 'clean' || result === 'hinted' || result === 'marked' ? STEP_XP : 0;
}

export interface XpBreakdown {
  level: number;
  steps: number;
  playback: number;
  total: number;
}

export interface XpService {
  /** Ledger write + profile.xp_total increment in one transaction (the repo guarantees it). */
  award(
    amount: number,
    reason: XpReason,
    refs?: { sessionId?: string | null; stepId?: string | null },
  ): { entry: XpLedgerRow; newTotal: number };
  total(): number;
  sessionBreakdown(sessionId: string): XpBreakdown;
}

export function createXpService(ctx: ServiceContext): XpService {
  const { repos, clock } = ctx;
  return {
    award(amount, reason, refs = {}) {
      return repos.xp.award({
        amount,
        reason,
        sessionId: refs.sessionId ?? null,
        stepId: refs.stepId ?? null,
        day: todayOf(ctx),
        createdAt: clock.now(),
      });
    },
    total: () => repos.profile.get()?.xpTotal ?? 0,
    sessionBreakdown(sessionId) {
      const out: XpBreakdown = { level: 0, steps: 0, playback: 0, total: 0 };
      for (const e of repos.xp.listBySession(sessionId)) {
        if (e.reason === 'level') out.level += e.amount;
        else if (e.reason === 'step') out.steps += e.amount;
        else out.playback += e.amount;
        out.total += e.amount;
      }
      return out;
    },
  };
}
