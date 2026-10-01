# 07 — Today

**Status:** done

The home screen: greeting, three practice blocks, primary CTA, track cards, plus first-run onboarding.

## Inputs

- `docs/handoff/design/Main.dc.html` (source of truth), `docs/ui.md` §3 row `/`, `docs/engine.md` §4 PlanService (what `TodayDto` contains).
- Channels: `me.get`, `me.update` (onboarding), `plan.getToday`, `content.tracks`, `tracks.setSettings` (enroll), `sessions.start`.
- Components from Task 06: AppHeader, Card, BlockRow, PrimaryButton, SecondaryButton, DashedButton, ProgressBar, Eyebrow.

## Deliverables

- `renderer/features/today/TodayPage.tsx` (+ `.module.css`), `TrackCard.tsx`, `AddTrackDialog.tsx`, `Onboarding.tsx` (one field: name; shown when `me.firstRun`).
- Route `/` in `app/router.tsx`; remove the placeholder Shell.
- Hooks: `useMe()`, `useToday()`, `useStartSession()` in `renderer/features/shared/hooks.ts` (TanStack Query wrappers over `api`).
- Fixture + `/dev/screens/today` with knobs `?done=0|1|2|3`.
- `e2e/today.spec.ts`: seed `day8`, assert the three blocks' eyebrows/titles/blurbs and CTA label; probe header, card, button metrics; screenshot `07-today.png`.

## Acceptance

- Matches Main.dc.html: grid two columns at 1280; h1 Fredoka 600 44px "Good evening, Harry." (greeting by local hour: morning <12, afternoon <18, evening otherwise); card radius 24 + shadow; block nodes done/current/upcoming styles; CTA 60px r18 with `--sh-primary`; track cards and compact rows as designed; dashed "Add something to learn".
- States beyond the design render per ui.md §3 (0/1/2/3 done; all-done variant with SecondaryButton "Practice something extra" and "Day n streak kept").
- CTA starts the session for the first non-done block and navigates to `/practice/:levelId?session=` (or `/tracks/:trackId/lesson` when `lessonFirst`, or `/ear/:levelId?session=`).
- Track cards link to `/tracks/:trackId`; "Add something to learn" enrolls a track via `tracks.setSettings`.
- `pnpm check` and `pnpm e2e` green.

## Out of scope

Practice/Complete/Path screens (routes may be stubs that render the route name).

## Notes

**What landed.** `features/today/` — `TodayPage.tsx` (wires `useMe`/`useToday`/`useTracks`/`useStartSession`/`useUpdateMe`/`useSetTrackSettings`; onboarding when `me.firstRun`), `TodayView.tsx` (presentational, IPC-free so it is unit-testable and drives the dev screen) + `TodayPage.module.css`, `TrackCard.tsx` (`TrackCard` + `TrackRow`), `AddTrackDialog.tsx`, `Onboarding.tsx`, `today.ts` (pure: `greetingFor`, `blockStates`, `ctaAction`, `partitionTracks`, `addableTracks`, `ctaNote`), `dev.tsx` (`/dev/screens/today?done=0|1|2|3&midi=…&add=1`), `today.test.tsx` (21 tests), `e2e/today.spec.ts`, `e2e/screenshots/07-today.png`. Route table and shared hooks were already in place (scaffold commit), so neither was edited.

**Deviations from Main.dc.html / the task.**

- _CTA label._ The design shows "Continue with A major"; seed `day8` has the learn block `pending`, so the engine says "Start A major" (engine.md §4 step 8). The dev screen at `?done=1` (the default) marks the block `in_progress` to reproduce the design copy.
- _Greeting._ Computed in the renderer from the local hour and `me.name` (`greetingFor`), not taken from `TodayDto.greeting` (which uses the profile timezone). They agree unless the profile timezone differs from the OS.
- _Card vs row._ The design does not state the rule. Available circle-of-fifths tracks get the full card with progress bar (Main:119–145); ladder tracks (Ear training) and unavailable tracks get compact rows (Main:148–159). Unavailable rows stay non-interactive `<div>`s as designed; every available track (including the minor card, a `<div>` in the design) links to `/tracks/:trackId`.
- _Track card status colour._ In progress → tangerine border/bar/label (Main:119–125); every other status → teal bar and teal-deep label (Main:136–139), including "Complete".
- _CTA note without MIDI._ Main:109's "Your keyboard is listening — just play." shows only when a device is connected; otherwise "No keyboard? You can mark each chord as played."
- _All-done variant (ui.md §3)._ The subtitle becomes `cta.subtitle` ("Come back tomorrow to keep the streak."), the CTA becomes SecondaryButton "Practice something extra" → `/tracks`, and the note reads "Day n streak kept".
- _Not in the designs._ Onboarding (wordmark-only header, hero Card, Main:47 h1, 56px field styled like SecondaryButton, 60px PrimaryButton "Let's play"; also sends the OS timezone) and AddTrackDialog (an `--ink` 35% `color-mix` scrim, default Card, rows styled like Main:156 with a teal-deep "Start learning"; Escape/backdrop close). Enrolling adds the track from tomorrow's plan because today's plan is already persisted, and the dialog says so.
- _CTA element._ A `<button>` (PrimaryButton) instead of the design's `<a>`, because it calls `sessions.start` before navigating.

**Task 16 follow-ups.** The CTA no longer shrinks and wraps beside the longer no-keyboard note (`flex-shrink: 0; white-space: nowrap`). New edge states (not designed): no active tracks shows "Pick something to learn", which opens Add, with no plan card or note. When every active track is complete, the subtitle reads "Everything you’re learning is complete…" if nothing is planned. A "Left mid-way · Resume A major" row card (Main:148 styling, 48px OutlineInkButton) heads the tracks column, so it stays above the fold with a three-block plan.
