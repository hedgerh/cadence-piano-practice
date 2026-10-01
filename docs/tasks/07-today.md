# 07 — Today

**Status:** todo

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
