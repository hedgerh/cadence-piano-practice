# 09 — Complete + review wiring

**Status:** done

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

## Notes

Files: `renderer/features/complete/{CompletePage.tsx, CompleteView.tsx, CompletePage.module.css, complete.ts, complete.test.tsx, dev.tsx}`; Practice toast + invalidation in `features/practice/{usePracticeSession.ts, PracticeView.tsx, PracticePage.tsx, PracticePage.module.css, dev.tsx, xpToast.test.tsx}`; `e2e/complete.spec.ts`; screenshots `09-complete.png`, `09-complete-skipped.png`.

- **Data source.** The page renders the `CompleteDto` passed as router state by "Finish the key". Without state (direct link, relaunch) it calls `sessions.get`; only if the session is already finished does it call `sessions.finish`, which for a finished session returns the rebuilt DTO without writing (core `finishSession` early return; the e2e asserts XP is unchanged). An unfinished session is never finished from this page: it links back to Practice instead.
- **Header pills.** Practice's live IPC now runs `useInvalidateProgress()` after every `recordStep`. `finish` already invalidated. The Complete screen itself has no header (as designed); the e2e checks the Today pills after "Done for today".
- **+5 XP toast** (not in any design): it shows the `xpAwarded` returned by `recordStep` (so skips show none) as a Fredoka 700 18px pill with a `--tangerine-tint` fill and `2px --tangerine` border, fixed bottom-right at 24px and lifted to 112px so it clears the Practice:120 strip. It lasts 1.2 s (fade/rise) and is static under reduced motion.

Deviations from Complete.dc.html:

- Done chips use RomanChip's state mode, which adds a 2px teal border (`box-sizing: border-box`) where the design has none. The size is unchanged.
- The time tile shows the real duration (`m:ss`). The e2e therefore asserts `\d+:\d{2}` instead of "2:xx".
- Skipped variant (ui.md §3, not designed):
  - Skipped chips are dashed with the sub line "Bm · skipped". Marked chips are teal with "D · marked".
  - The subtitle's first sentence becomes "Five of seven played, two skipped for now." The engine's circle sentence is kept.
  - The primary is "Play the two you skipped". It starts a `review` session of the same level, which replays all seven chords because the engine has no per-step sessions.
  - "Keep going" becomes the SecondaryButton and "Done for today" a TextButton. The actions row wraps whole buttons (`flex-wrap`, `row-gap: 0`, `nowrap` labels).
- With nothing left on the circle, "Done for today" is the only action and the "Next on the circle" label is hidden. Ladder tracks read "Next: Level 4".
- Review on the next day: the plan holds one review block, for the level with the most due steps (engine.md §4 PlanService 3). Its blurb names numerals ("vii°"), not chord names. A first clean pass schedules all seven A major steps 1 day out. With day8's seeded history, D major ties A major at 7 due and wins on content order, so day 9's review block is D major. The e2e therefore asserts that A major has 7 due steps, that a "Review · due today" block exists, and that an A major review session carries vii° as the one `hinted` step due that day. It does not assert an A major block naming G♯°. Getting that would need a PlanService change (core, out of scope).
