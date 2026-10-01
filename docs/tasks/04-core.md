# 04 — `@cadence/core`

**Status:** done

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

## Notes

Implemented in `packages/core/src/`: `clock.ts`, `context.ts` (shared deps + copy helpers), `content.service.ts`, `review.service.ts`, `xp.service.ts`, `streak.service.ts`, `settings.service.ts`, `questions.ts`, `progress.service.ts` (sessions, level state, `nextLevel`, `trackOverview`, track cards, `CompleteDto`), `plan.service.ts`, `dto.ts`, `services.ts` (`createServices` + `Services` type), `seed.ts`, `testing/` (`createMemoryRepos`, test harness). 90 tests in core (`*.test.ts`), each citing HANDOFF §5 / engine.md §4.

Deviations and defaults chosen:

- **`unlockText`** reproduces EarPath.dc.html exactly with a rule that depends on the source stage: "Unlocks at <S> L<N>" while S is open, otherwise "Unlocks after <S> L<N−1>" (always "after" when N = levels.length + 1). A purely length-based rule cannot produce "after Scale degrees L3" because Scale degrees has 4 levels. See decisions.md.
- **Scheduling within one session**: a step repeated in the same ear session (small pools cycle) advances its interval at most once; a repeated miss still resets it.
- **`recordStep` retries** on the same (sessionId, ordinal) never reschedule. They award only the XP difference (0 for an identical retry). Recording into a finished session throws. `finishSession` is idempotent: a second call rebuilds the same `CompleteDto` with no new writes.
- **Day log / streak**: `blocks_completed` is incremented by any completed chord level or passed ear level, including ones outside the plan ("any finished level counts"). Failed ear attempts add `sessions_completed` only. Abandoned sessions write nothing. `atRisk = !keptToday`.
- **Plan blocks**: `sessions.start` without `planBlockId` claims today's not-done block for the same level. A failed or abandoned session puts its block back to `pending`. `sessions.start` resumes an unfinished session for the same level started today.
- **Before onboarding**, `plan.getToday` returns an empty plan and persists nothing. `me.update` with no profile creates it (with the default enrolment).
- **Free play** happens only when there is no learn block and no review block: one warm-up of a mastered level chosen with a PRNG seeded by the day (`kind: 'free'`).
- **Mastery** for ear levels means every pool step is at 7 days or more. `level_progress.mastered` / `mastered_at` are recomputed on every finish, and mastery can be lost.
- **Seed**: `seed(services, scenario, {name?, timezone?})` takes `'first-run'` (the state right after onboarding: profile "Harry" + default enrolment), `'day8'`, `'ear-unlocked'` and `'advance-day'` (moves an `AdjustableClock`; `SystemClock.offsetMs` supports it; Task 09 still has to persist the offset in main). Seeds throw on a non-empty DB. `day8` runs the real services on past local days (local noon, k = 7..1), so the ledger, `xp_total` (1,240), `day_log` (8 consecutive days) and the schedule are all consistent. Today's warm-up is then played through the real plan block.
- **Copy not given by the designs** (engine-generated, can be changed later): review blurbs for one skipped / missed / marked / clean-due step ("You skipped vii° last time. Let's lock it in." / "vii° is due. Quick pass."), and for more than 3 due steps "I, ii and 5 more are due. Quick pass."; ear warm-up "Last time: 7 of 10 right."; free-play blurb "Nothing new or due today. Play one you know."; empty Today subtitle; "Explore the tracks" CTA when there are no blocks; ear learn eyebrow "Learn · new level"; block meta " · in progress"; Complete titles "C major, not finished", "Intervals · Level 1, passed", "Not yet — 7 of 10"; first-key subtitle "That's your first key on the circle."
- **`TodayDto.summary`** rounds the estimate to the nearest 5 minutes ("3 blocks · ~10 min" for 2+5+2). The raw sum is in `estimateMin`.
