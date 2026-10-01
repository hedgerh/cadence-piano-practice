// Seed scenarios for tests and e2e (`dev.seed`). History is produced by driving the real
// services on past local days (a FakeClock-backed service set over the same repos), so the
// XP ledger, profile total, day_log, step schedule and level progress stay consistent.
//
// - 'first-run':    the state right after onboarding (profile + default enrolment).
// - 'day8':         Main.dc.html / Complete.dc.html sample: 8-day streak, 1,240 XP, C/G/D
//                   complete, Intervals L1–L2 passed; today's warm-up (C major) done, learn
//                   A major, review G major (vii° hinted yesterday).
// - 'ear-unlocked': first-run + Intervals L1–L5, Scale degrees L1–L4, Chords in a key L1–L3
//                   passed today, so every ear stage (including Find the key) is open.
// - 'advance-day':  moves an adjustable clock forward one day (FakeClock / SystemClock offset).
import { FakeClock, isAdjustableClock } from './clock';
import { addDays, localNoon, systemTimezone } from './dates';
import type { SessionKind } from './ports';
import { type Services, createServices } from './services';

export type SeedScenario = 'first-run' | 'day8' | 'ear-unlocked' | 'advance-day';

export interface SeedOptions {
  /** Defaults to "Harry" (the designs' learner). */
  name?: string;
  /** Defaults to the host timezone. */
  timezone?: string;
}

interface Play {
  levelId: string;
  kind: SessionKind;
  planBlockId?: string;
  /** Chord steps resolved `hinted` (hint level 1). */
  hinted?: readonly string[];
  /** Ear: number of verified play-backs (first N questions). */
  playbacks?: number;
}

const MS_PER_DAY = 86_400_000;

/** Play a whole level through the public service API: every step clean unless listed. */
export function playLevel(svc: Services, play: Play, tick: () => void = () => {}): void {
  const session = svc.progress.startLevel(play.levelId, play.kind, play.planBlockId);
  const hinted = new Set(play.hinted ?? []);
  let playbacks = play.playbacks ?? 0;
  if (session.isEar) {
    for (const q of session.questions) {
      tick();
      svc.progress.recordStep({
        sessionId: session.sessionId,
        stepId: q.id,
        ordinal: q.ordinal,
        result: 'clean',
        hintLevel: 0,
        chosen: q.match.type === 'choice' ? q.match.answer : null,
        elapsedMs: 3_000,
      });
      if (playbacks > 0) {
        svc.progress.recordPlayback({ sessionId: session.sessionId, ordinal: q.ordinal });
        playbacks--;
      }
    }
  } else {
    session.steps.forEach((step, ordinal) => {
      tick();
      const isHinted = hinted.has(step.id);
      svc.progress.recordStep({
        sessionId: session.sessionId,
        stepId: step.id,
        ordinal,
        result: isHinted ? 'hinted' : 'clean',
        hintLevel: isHinted ? 1 : 0,
        elapsedMs: isHinted ? 9_000 : 4_000,
      });
    });
  }
  tick();
  const steps = session.isEar ? session.questions.length : session.steps.length;
  svc.progress.finishSession({ sessionId: session.sessionId, durationMs: steps * 15_000 });
}

/** day8 history, by days ago (engine.md §4.T: seed reproduces Main.dc.html exactly). */
const DAY8_HISTORY: ReadonlyArray<readonly [number, readonly Play[]]> = [
  [7, [{ levelId: 'c-major', kind: 'learn' }]],
  [
    6,
    [
      { levelId: 'g-major', kind: 'learn' },
      { levelId: 'c-major', kind: 'review' },
    ],
  ],
  [
    5,
    [
      { levelId: 'intervals-1', kind: 'learn', playbacks: 5 },
      { levelId: 'g-major', kind: 'review' },
    ],
  ],
  [
    4,
    [
      { levelId: 'd-major', kind: 'learn' },
      { levelId: 'intervals-1', kind: 'review', playbacks: 5 },
    ],
  ],
  [
    3,
    [
      { levelId: 'intervals-2', kind: 'learn', playbacks: 5 },
      { levelId: 'c-major', kind: 'review' },
    ],
  ],
  [
    2,
    [
      { levelId: 'd-major', kind: 'review' },
      { levelId: 'intervals-2', kind: 'review', playbacks: 4 },
    ],
  ],
  [
    1,
    [
      { levelId: 'g-major', kind: 'review', hinted: ['d7'] },
      { levelId: 'intervals-1', kind: 'review', playbacks: 4 },
    ],
  ],
];

const EAR_UNLOCKED_LEVELS: readonly string[] = [
  'intervals-1',
  'intervals-2',
  'intervals-3',
  'intervals-4',
  'intervals-5',
  'scale-degrees-1',
  'scale-degrees-2',
  'scale-degrees-3',
  'scale-degrees-4',
  'chords-in-key-1',
  'chords-in-key-2',
  'chords-in-key-3',
];

function requireEmpty(services: Services): void {
  if (services.repos.profile.get()) {
    throw new Error('seed: the database already has a profile (seed a fresh database)');
  }
}

function seedDay8(services: Services, name: string, timezone: string): void {
  const base = services.clock;
  const today = base.today(timezone);
  const now = base.now();
  const noonDaysAgo = (k: number): number =>
    localNoon(addDays(today, -k), timezone, now - k * MS_PER_DAY);

  const clock = new FakeClock(noonDaysAgo(7) - 3_600_000);
  const past = createServices({ repos: services.repos, content: services.content, clock });
  past.settings.createProfile({ name, timezone });

  for (const [daysAgo, plays] of DAY8_HISTORY) {
    clock.set(noonDaysAgo(daysAgo));
    for (const play of plays) {
      playLevel(past, play, () => clock.advanceMs(1_000));
      clock.advanceMinutes(5);
    }
  }

  // Today: build the plan with the real clock and play the warm-up block (C major).
  const plan = services.plan.getToday();
  const warm = plan.blocks.find((b) => b.type === 'warmup');
  if (!warm) throw new Error('seed day8: expected a warm-up block');
  playLevel(services, { levelId: warm.levelId, kind: 'warmup', planBlockId: warm.id });
}

export function seed(services: Services, scenario: SeedScenario, opts: SeedOptions = {}): void {
  const name = opts.name ?? 'Harry';
  const timezone = opts.timezone ?? systemTimezone();
  switch (scenario) {
    case 'first-run':
      requireEmpty(services);
      services.settings.createProfile({ name, timezone });
      return;
    case 'day8':
      requireEmpty(services);
      seedDay8(services, name, timezone);
      return;
    case 'ear-unlocked':
      requireEmpty(services);
      services.settings.createProfile({ name, timezone });
      for (const levelId of EAR_UNLOCKED_LEVELS) playLevel(services, { levelId, kind: 'free' });
      return;
    case 'advance-day':
      if (!isAdjustableClock(services.clock)) {
        throw new Error('seed advance-day: the clock cannot be moved');
      }
      services.clock.advanceDays(1);
      return;
  }
}
