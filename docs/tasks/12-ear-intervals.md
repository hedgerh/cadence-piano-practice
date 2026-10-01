# 12 — Ear: Intervals drill + results

**Status:** todo

The first ear-training drill (intervals), the shared ear reducer, the feedback panel wiring, play-back detection, and the pass/fail results screen.

## Inputs

- `docs/handoff/design/EarInterval.dc.html` (its `<script>` is the state pseudo-code and the Web Audio envelope); `docs/ui.md` §2 (PlayButton, AnswerChip, FeedbackPanel, SegmentedProgress) and §3 rows `/ear/:levelId`, `/ear/results/:sessionId`; `docs/engine.md` §5 (ear reducer), §6 defaults 10–12, §4 question selection.
- Channels: `content.track`, `sessions.start` (returns `questions[]`), `sessions.recordStep`, `sessions.recordPlayback`, `sessions.finish`.
- Audio: `player.play(step.play)`; MIDI: `useHeldNotes`, `useMidiEvents` for play-back detection.

## Deliverables

- `renderer/features/ear/earDrillReducer.ts` (pure), `useEarDrill.ts` (auto-play 300 ms after a question appears; gate answers until the first play resolves; post `recordStep` on `PICK`; play-back detection with `reduceMatch({type:'sequence', anyOctave:true})` for `notes` sounds and chord matching for `chord` sounds → `recordPlayback` once; `finish` after the last question), `EarDrillPage.tsx` (route `/ear/:levelId`, picks the drill component by the level's step `match`/`play` types), `IntervalDrill.tsx` (+ css), `EarResultsPage.tsx` (+ css) at `/ear/results/:sessionId` with pass and fail variants per ui.md §3.
- Fixtures + `/dev/screens/ear-interval?phase=listen|answered`, `/dev/screens/ear-results?result=pass|fail`.
- Reducer tests: answers disabled before first play; `PICK` sets `answered` and `correct`; play-back awards once; `NEXT` advances; after 10 → `done` with `passed = correct ≥ 8`.
- `e2e/ear-interval.spec.ts`: seed `day8`; open Intervals L3; assert 13 chips with only `P1 M2 m3 M3 P4 P5 P8` active; press play, pick an answer, assert feedback panel copy and the one-octave keyboard lights; play back via dev MIDI and assert "+5"; complete 10 questions with ≥8 correct (the fixture/seed must make the target deterministic in e2e — expose the current target through `window.__cadenceDev.ear.currentAnswer` in e2e only); assert the pass screen and that EarPath now shows Scale degrees still locked (unlock is at L4) ; screenshots `12-ear-interval.png`, `12-ear-interval-answered.png`, `12-ear-results.png`.

## Acceptance

- Pixel-faithful to EarInterval.dc.html in `listen` and `answered` states (chip states, feedback panel colors, 112px play button with `--sh-play`).
- Audio: C4 for 0.7 s then the target at +0.8 s for 0.9 s with the triangle envelope from engine.md §7.
- A wrong answer shows the correct chip teal and the chosen chip in tangerine tint with `--tangerine-deep` border; the progress segment turns lavender immediately.
- Results: pass variant with "+40 XP" and "Keep going — Level 4"; fail variant "Not yet — n of 10" with "Try Level 3 again" (new session, same level). No red anywhere.
- Misses are due tomorrow (visible in Today after the `advance-day` seed).
- `pnpm check` and `pnpm e2e` green.

## Out of scope

Other ear stages (Tasks 13–15).
