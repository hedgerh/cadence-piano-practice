# 09 — Complete + review wiring

**Status:** todo

The key-complete screen and the end-to-end loop it closes: XP and streak in the header, review scheduling visible on tomorrow's Today, "Keep going" to the next key.

## Inputs

- `docs/handoff/design/Complete.dc.html`, `docs/ui.md` §3 row `/complete/:sessionId`, `docs/engine.md` §4 (ProgressService.finishSession, XpService, ReviewService.reviewNote), §6 defaults 2, 7, 8.
- Channels: `sessions.get`/`sessions.finish` (DTO), `sessions.start` (next key), `me.get`.
- Components: Card hero, Confetti, RomanChip (state mode, h60), StatTile, ProgressBar, PrimaryButton, SecondaryButton, TextButton.

## Deliverables

- `renderer/features/complete/CompletePage.tsx` + css; `formatDuration(ms)` → `m:ss`.
- Live `+5` XP toast in Practice on each resolved step (small, tangerine tint, bottom-right, 1.2 s) and header pills refreshing via `['me.get']` invalidation after `recordStep`/`finish`.
- Fixture + `/dev/screens/complete` with knobs `?skipped=1,4`.
- `e2e/complete.spec.ts`: seed `day8`, run A major with G♯° hinted (via dev MIDI + hint clicks), finish; assert "A major, complete", chips (6 teal + "G♯° · hint"), "2:xx"/"6 of 7"/"+40 XP"/"day 8 streak kept", "4 of 12 keys", "Next on the circle: E major", review note; then `dev.seed({scenario:'advance-day'})` (add this scenario in core: moves FakeClock/`now` offset by one day — implement as a persisted clock offset read by `SystemClock` only when `CADENCE_E2E=1`) and assert Today shows a review block for A major naming G♯°; screenshot `09-complete.png`.

## Acceptance

- Pixel-faithful to Complete.dc.html (hero card r28 `--sh-card-lg`, 84px check with `--halo-check`, stat tiles, lavender XP tile, 33.3% bar, confetti positions).
- Skipped variant per ui.md §3 (dashed chips, adjusted copy, "Play the two you skipped" primary, "Keep going" demoted).
- "Keep going — E major" starts a session for the next uncompleted key (reusing today's plan block when it matches) and routes to Practice; "Done for today" routes to `/`.
- Header XP total and streak update without reload.
- `pnpm check` and `pnpm e2e` green.

## Out of scope

Ear results screen (Task 12).
