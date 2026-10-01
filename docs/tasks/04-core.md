# 04 — `@cadence/core`

**Status:** todo

The engine: plan builder, review scheduler, XP, streak, progress/sessions, settings. Plain TypeScript services built on the ports from Task 03, with a `FakeClock` and in-memory repos for tests.

## Inputs

- `docs/engine.md` §4 (every service, algorithm and copy string), §6 (resolved defaults). `docs/handoff/HANDOFF.md` §5.
- Design sample data to reproduce in the `day8` seed: `Main.dc.html` (8-day streak, 1,240 XP, C/G/D complete, A major next, G major review with a vii° hint, Intervals Level 3), `Complete.dc.html` (A major with G♯° hinted → "6 of 7", "+40 XP", "4 of 12 keys", "Next on the circle: E major").

## Deliverables

`packages/core/src/`:

- `clock.ts` — `SystemClock`, `FakeClock` (settable `now`, `advanceDays`).
- `content.service.ts`, `review.service.ts`, `progress.service.ts`, `xp.service.ts`, `streak.service.ts`, `plan.service.ts`, `settings.service.ts`, `questions.ts` (ear question selection).
- `dto.ts` — `TodayDto`, `PlanBlockDto`, `TrackCardDto`, `TrackOverviewDto`, `SessionDto`, `CompleteDto`, `MeDto` (these become the zod outputs in Task 05; define them as TS types here and keep field names identical to `docs/architecture.md` §3).
- `services.ts` — `createServices({ repos, content, clock })` returning a plain object of services.
- `seed.ts` — `seed(services, scenario: 'first-run' | 'day8')`.
- `testing/` — in-memory repo implementations of every port (also used by Task 05 e2e via `dev.seed` if convenient).
- Tests for every rule in engine.md §4.T.

## Acceptance

- Review schedule: five consecutive `clean` results produce due offsets 1, 3, 7, 14, 30; a `hinted`/`skipped`/`marked`/`wrong` result resets to due tomorrow; a level is mastered only when every step has `interval_days ≥ 7`.
- XP: step 5 for clean/hinted/marked and correct ear answers, 0 for skipped/wrong; level 40; playback 5 once per question; `profile.xp_total` matches the ledger sum.
- Streak: completions at 23:30 and next day 00:30 local in `America/Los_Angeles` count as two days; a missed day resets; `atRisk` true when today has no completion yet.
- Plan: first run → single learn block (C major), no warm-up/review, CTA "Start C major"; `day8` seed → warm-up C major (done), learn A major with blurb "Next stop on the circle of fifths. Three sharps: F♯, C♯, G♯.", review G major with blurb "You needed a hint on vii° last time. Let's lock it in.", CTA "Start A major"; plan is persisted and unchanged on a second call the same day; learn slot alternates between two active tracks across two days; all blocks done → CTA "That's today — explore the tracks".
- Finishing A major with G♯° hinted yields `CompleteDto` with `cleanCount 6`, `xp.level 40`, `track.done 4`, `track.nextTitle 'E major'`, `reviewNote` "G♯° will come back in tomorrow's review until it's clean."
- Question selection: due steps first, no back-to-back repeats, small pools cycle to `pass.of`.
- `pnpm check` green.

## Out of scope

Electron, IPC, UI. Do not import `@cadence/db` (ESLint will block it); use the in-memory repos for tests.
