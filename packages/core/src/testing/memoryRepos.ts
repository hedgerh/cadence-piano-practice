// In-memory implementations of every port in ports.ts. Semantics mirror packages/db/src/repos:
// upserts replace every non-key field, `xp.award` writes the ledger and bumps the profile
// total atomically, `sessions.upsertStep` is idempotent on (sessionId, ordinal),
// `markPlayedBack` reports whether it changed, `dayLog.increment` adds counters.
// `transaction` snapshots the whole store and restores it if `fn` throws (savepoint-like).
import type {
  DailyPlanRow,
  DayLogIncrement,
  DayLogRepo,
  DayLogRow,
  DueCount,
  LevelProgressRepo,
  LevelProgressRow,
  NewPlanBlock,
  NewProfile,
  NewSession,
  NewXpEntry,
  PlanBlockPatch,
  PlanBlockRow,
  PlanRepo,
  PlanWithBlocks,
  ProfilePatch,
  ProfileRepo,
  ProfileRow,
  Repos,
  SessionPatch,
  SessionRepo,
  SessionRow,
  SessionStepRow,
  SessionStepUpsert,
  StepProgressRepo,
  StepProgressRow,
  StepProgressUpsert,
  TrackSettingsPatch,
  TrackSettingsRepo,
  TrackSettingsRow,
  XpLedgerRow,
  XpRepo,
} from '../ports';

interface Store {
  seq: number;
  profile: ProfileRow | null;
  trackSettings: Map<string, TrackSettingsRow>;
  stepProgress: Map<string, StepProgressRow>;
  levelProgress: Map<string, LevelProgressRow>;
  sessions: Map<string, SessionRow>;
  sessionSteps: Map<string, SessionStepRow>;
  xpLedger: XpLedgerRow[];
  dayLog: Map<string, DayLogRow>;
  plans: Map<string, DailyPlanRow>;
  planBlocks: Map<string, PlanBlockRow>;
}

const PROFILE_ID = 'local';

function emptyStore(): Store {
  return {
    seq: 0,
    profile: null,
    trackSettings: new Map(),
    stepProgress: new Map(),
    levelProgress: new Map(),
    sessions: new Map(),
    sessionSteps: new Map(),
    xpLedger: [],
    dayLog: new Map(),
    plans: new Map(),
    planBlocks: new Map(),
  };
}

const cmp = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0);
const clone = <T>(v: T): T => structuredClone(v);

/** Drop `undefined` entries so a patch never blanks a column (Drizzle ignores them too). */
function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** A fresh, empty set of in-memory repositories. */
export function createMemoryRepos(): Repos {
  let s = emptyStore();
  const newId = (prefix: string): string => `${prefix}_${++s.seq}`;

  function transaction<T>(fn: () => T): T {
    const snapshot = structuredClone(s);
    try {
      return fn();
    } catch (err) {
      s = snapshot;
      throw err;
    }
  }

  const profile: ProfileRepo = {
    get: () => (s.profile ? clone(s.profile) : null),
    create({ name, timezone, now }: NewProfile): ProfileRow {
      if (s.profile) throw new Error('Profile already exists');
      s.profile = {
        id: PROFILE_ID,
        name,
        timezone,
        xpTotal: 0,
        midiDeviceId: null,
        midiDeviceName: null,
        showMarkPlayedAlways: false,
        autoContinue: true,
        createdAt: now,
        updatedAt: now,
      };
      return clone(s.profile);
    },
    update(patch: ProfilePatch, now: number): ProfileRow {
      if (!s.profile) throw new Error('Profile does not exist');
      s.profile = { ...s.profile, ...definedOnly(patch), updatedAt: now };
      return clone(s.profile);
    },
    addXp(amount: number, now: number): number {
      if (!s.profile) throw new Error('Profile does not exist');
      s.profile = { ...s.profile, xpTotal: s.profile.xpTotal + amount, updatedAt: now };
      return s.profile.xpTotal;
    },
  };

  const trackSettings: TrackSettingsRepo = {
    get: (trackId) => {
      const row = s.trackSettings.get(trackId);
      return row ? clone(row) : null;
    },
    list: () =>
      [...s.trackSettings.values()]
        .sort((a, b) => cmp(a.enrolledAt, b.enrolledAt) || cmp(a.trackId, b.trackId))
        .map(clone),
    upsert(row: TrackSettingsRow): TrackSettingsRow {
      s.trackSettings.set(row.trackId, clone(row));
      return clone(row);
    },
    update(trackId: string, patch: TrackSettingsPatch): TrackSettingsRow | null {
      const row = s.trackSettings.get(trackId);
      if (!row) return null;
      const next = { ...row, ...definedOnly(patch) };
      s.trackSettings.set(trackId, next);
      return clone(next);
    },
  };

  const spKey = (levelId: string, stepId: string): string => `${levelId}\u0000${stepId}`;
  const isDue = (row: StepProgressRow, today: string): boolean =>
    row.dueOn !== null && row.dueOn <= today;

  const stepProgress: StepProgressRepo = {
    get: (levelId, stepId) => {
      const row = s.stepProgress.get(spKey(levelId, stepId));
      return row ? clone(row) : null;
    },
    listByLevel: (levelId) =>
      [...s.stepProgress.values()]
        .filter((r) => r.levelId === levelId)
        .sort((a, b) => cmp(a.stepId, b.stepId))
        .map(clone),
    listByTrack: (trackId) =>
      [...s.stepProgress.values()]
        .filter((r) => r.trackId === trackId)
        .sort((a, b) => cmp(a.levelId, b.levelId) || cmp(a.stepId, b.stepId))
        .map(clone),
    listDue: (today) =>
      [...s.stepProgress.values()]
        .filter((r) => isDue(r, today))
        .sort(
          (a, b) =>
            cmp(a.dueOn ?? '', b.dueOn ?? '') ||
            cmp(a.levelId, b.levelId) ||
            cmp(a.stepId, b.stepId),
        )
        .map(clone),
    dueCountByLevel(today: string): DueCount[] {
      const by = new Map<string, DueCount>();
      for (const r of s.stepProgress.values()) {
        if (r.dueOn === null || r.dueOn > today) continue;
        const k = `${r.levelId}\u0000${r.trackId}`;
        const cur = by.get(k);
        if (cur) {
          cur.count++;
          if (r.dueOn < cur.earliestDueOn) cur.earliestDueOn = r.dueOn;
        } else {
          by.set(k, { levelId: r.levelId, trackId: r.trackId, count: 1, earliestDueOn: r.dueOn });
        }
      }
      return [...by.values()].sort((a, b) => cmp(a.levelId, b.levelId));
    },
    upsert(row: StepProgressUpsert): StepProgressRow {
      const k = spKey(row.levelId, row.stepId);
      const existing = s.stepProgress.get(k);
      const next: StepProgressRow = existing
        ? { ...row, id: existing.id, createdAt: existing.createdAt }
        : { ...row, id: newId('sp') };
      s.stepProgress.set(k, clone(next));
      return clone(next);
    },
  };

  const levelProgress: LevelProgressRepo = {
    get: (levelId) => {
      const row = s.levelProgress.get(levelId);
      return row ? clone(row) : null;
    },
    listByTrack: (trackId) =>
      [...s.levelProgress.values()]
        .filter((r) => r.trackId === trackId)
        .sort((a, b) => cmp(a.levelId, b.levelId))
        .map(clone),
    listAll: () =>
      [...s.levelProgress.values()].sort((a, b) => cmp(a.levelId, b.levelId)).map(clone),
    listMastered: () =>
      [...s.levelProgress.values()]
        .filter((r) => r.mastered)
        .sort((a, b) => cmp(a.levelId, b.levelId))
        .map(clone),
    upsert(row: LevelProgressRow): LevelProgressRow {
      s.levelProgress.set(row.levelId, clone(row));
      return clone(row);
    },
  };

  const stepRowKey = (sessionId: string, ordinal: number): string => `${sessionId}\u0000${ordinal}`;

  const sessions: SessionRepo = {
    create(input: NewSession): SessionRow {
      const row: SessionRow = {
        id: input.id ?? newId('ses'),
        trackId: input.trackId,
        levelId: input.levelId,
        kind: input.kind,
        planBlockId: input.planBlockId ?? null,
        startedAt: input.startedAt,
        finishedAt: null,
        durationMs: null,
        stepsTotal: 0,
        stepsClean: 0,
        stepsHinted: 0,
        stepsSkipped: 0,
        stepsMarked: 0,
        stepsWrong: 0,
        correct: null,
        passed: null,
        xpSteps: 0,
        xpLevel: 0,
        xpPlayback: 0,
        questionOrder: input.questionOrder ? [...input.questionOrder] : null,
        focus: input.focus ?? null,
        run: input.run ?? null,
      };
      if (s.sessions.has(row.id)) throw new Error(`Session ${row.id} already exists`);
      s.sessions.set(row.id, row);
      return clone(row);
    },
    get: (id) => {
      const row = s.sessions.get(id);
      return row ? clone(row) : null;
    },
    update(id: string, patch: SessionPatch): SessionRow | null {
      const row = s.sessions.get(id);
      if (!row) return null;
      const next = { ...row, ...clone(definedOnly(patch)) };
      s.sessions.set(id, next);
      return clone(next);
    },
    listByLevel: (levelId) =>
      [...s.sessions.values()]
        .filter((r) => r.levelId === levelId)
        .sort((a, b) => cmp(a.startedAt, b.startedAt))
        .map(clone),
    listStartedBetween: (fromMs, toMs) =>
      [...s.sessions.values()]
        .filter((r) => r.startedAt >= fromMs && r.startedAt < toMs)
        .sort((a, b) => cmp(a.startedAt, b.startedAt))
        .map(clone),
    upsertStep(step: SessionStepUpsert): SessionStepRow {
      const k = stepRowKey(step.sessionId, step.ordinal);
      const existing = s.sessionSteps.get(k);
      const { id, playedBack, ...fields } = step;
      const next: SessionStepRow = existing
        ? {
            ...existing,
            levelId: fields.levelId,
            stepId: fields.stepId,
            result: fields.result,
            hintLevel: fields.hintLevel,
            tries: fields.tries,
            chosen: fields.chosen,
            elapsedMs: fields.elapsedMs,
            ...(playedBack === undefined ? {} : { playedBack }),
          }
        : { ...fields, id: id ?? newId('step'), playedBack: playedBack ?? false };
      s.sessionSteps.set(k, next);
      return clone(next);
    },
    listSteps: (sessionId) =>
      [...s.sessionSteps.values()]
        .filter((r) => r.sessionId === sessionId)
        .sort((a, b) => cmp(a.ordinal, b.ordinal))
        .map(clone),
    markPlayedBack(sessionId: string, ordinal: number): boolean {
      const row = s.sessionSteps.get(stepRowKey(sessionId, ordinal));
      if (!row || row.playedBack) return false;
      row.playedBack = true;
      return true;
    },
  };

  const xp: XpRepo = {
    // engine.md §4 XpService: ledger write + profile.xp_total increment in one transaction.
    award(input: NewXpEntry): { entry: XpLedgerRow; newTotal: number } {
      return transaction(() => {
        const { id, ...rest } = input;
        const entry: XpLedgerRow = { ...rest, id: id ?? newId('xp') };
        s.xpLedger.push(entry);
        const newTotal = profile.addXp(input.amount, input.createdAt);
        return { entry: clone(entry), newTotal };
      });
    },
    listBySession: (sessionId) =>
      s.xpLedger
        .filter((e) => e.sessionId === sessionId)
        .sort((a, b) => cmp(a.createdAt, b.createdAt))
        .map(clone),
    listByDay: (day) =>
      s.xpLedger
        .filter((e) => e.day === day)
        .sort((a, b) => cmp(a.createdAt, b.createdAt))
        .map(clone),
    sumByDay: (day) => s.xpLedger.filter((e) => e.day === day).reduce((n, e) => n + e.amount, 0),
  };

  const dayLog: DayLogRepo = {
    get: (day) => {
      const row = s.dayLog.get(day);
      return row ? clone(row) : null;
    },
    listRange: (fromDay, toDay) =>
      [...s.dayLog.values()]
        .filter((r) => r.day >= fromDay && r.day <= toDay)
        .sort((a, b) => cmp(a.day, b.day))
        .map(clone),
    upsert(row: DayLogRow): DayLogRow {
      s.dayLog.set(row.day, clone(row));
      return clone(row);
    },
    increment({ day, blocks, sessions: n, xp: amount, at }: DayLogIncrement): DayLogRow {
      const cur = s.dayLog.get(day);
      const next: DayLogRow = cur
        ? {
            ...cur,
            blocksCompleted: cur.blocksCompleted + blocks,
            sessionsCompleted: cur.sessionsCompleted + n,
            xp: cur.xp + amount,
          }
        : { day, blocksCompleted: blocks, sessionsCompleted: n, xp: amount, firstCompletedAt: at };
      s.dayLog.set(day, next);
      return clone(next);
    },
  };

  const getPlan = (day: string): PlanWithBlocks | null => {
    const plan = s.plans.get(day);
    if (!plan) return null;
    const blocks = [...s.planBlocks.values()]
      .filter((b) => b.day === day)
      .sort((a, b) => cmp(a.slot, b.slot))
      .map(clone);
    return { plan: clone(plan), blocks };
  };

  const plans: PlanRepo = {
    get: getPlan,
    save(plan: DailyPlanRow, blocks: NewPlanBlock[]): PlanWithBlocks {
      return transaction(() => {
        s.plans.set(plan.day, clone(plan));
        for (const block of blocks) {
          if (block.day !== plan.day) {
            throw new Error(`Plan block for ${block.day} saved with plan for ${plan.day}`);
          }
          const existing = [...s.planBlocks.values()].find(
            (b) => b.day === block.day && b.slot === block.slot,
          );
          const { id, ...rest } = block;
          const row: PlanBlockRow = existing
            ? { ...rest, id: existing.id }
            : { ...rest, id: id ?? newId('blk') };
          s.planBlocks.set(row.id, clone(row));
        }
        const saved = getPlan(plan.day);
        if (!saved) throw new Error(`Plan for ${plan.day} was not saved`);
        return saved;
      });
    },
    getBlock: (id) => {
      const row = s.planBlocks.get(id);
      return row ? clone(row) : null;
    },
    updateBlock(id: string, patch: PlanBlockPatch): PlanBlockRow | null {
      const row = s.planBlocks.get(id);
      if (!row) return null;
      const next = { ...row, ...definedOnly(patch) };
      s.planBlocks.set(id, next);
      return clone(next);
    },
  };

  return {
    profile,
    trackSettings,
    stepProgress,
    levelProgress,
    sessions,
    xp,
    dayLog,
    plans,
    transaction,
  };
}
