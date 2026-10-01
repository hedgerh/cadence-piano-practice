# 11 — EarPath (ladder track map)

**Status:** done

The ladder map for non-key tracks: five stages with unlock conditions and level progress.

## Inputs

- `docs/handoff/design/EarPath.dc.html`; `docs/ui.md` §2 (StageRow, NumberedList, Card highlight lavender) and §3 row `/tracks/:trackId` (ladder); `docs/engine.md` §4 `trackOverview` (ladder stage states, `unlockText`), §6 default 9.
- Channels: `tracks.overview`, `content.track`, `sessions.start`.

## Deliverables

- `renderer/features/path/LadderPathPage.tsx` (+ css) rendered for `map:'ladder'`; "How a level works" card (copy from EarPath.dc.html lines 58–66, kept in the renderer as static copy since it describes the engine, not content); "Up next" lavender card from `overview.upNext`; "Start Level N" → `sessions.start` → `/ear/:levelId?session=`.
- `StageRow` states: `current` (tangerine node, level segments), `locked` (unlock copy from `unlockText`), `done` (teal check, "Complete").
- Fixture + `/dev/screens/earpath`.
- `e2e/earpath.spec.ts`: seed `day8`; assert stage titles, unlock copy ("Unlocks at Intervals L4", "Unlocks at Intervals L5", "Unlocks after Scale degrees L3", "Unlocks after Chords in a key L2" — generated from the Unlock, so the engine must emit exactly this wording for these cases), current card "Level 3 of 6" with 2 teal + 1 tangerine + 3 grey segments; probe node 48px, rail 3px `--line-strong`, card radius 18; screenshot `11-earpath.png`.

## Acceptance

- Pixel-faithful to EarPath.dc.html; grid `align-items:start`.
- Unlock chain renders from content (no hardcoded stage list in the renderer).
- `pnpm check` and `pnpm e2e` green.

## Out of scope

Drill screens (Tasks 12–15).

## Notes

- Files: `features/path/LadderPathPage.tsx` (data: `useMe`, `useTracks`, `useTrackOverview`, `useStartSession`, `useSetTrackSettings`), `LadderPathView.tsx` (pure view), `LadderModel.ts` (overview → StageRow/TrackPill mapping), `LadderPathPage.module.css` (EarPath.dc.html lines cited), `LadderPathPage.test.tsx`; dev screen `features/earpath/dev.tsx`; `e2e/earpath.spec.ts`; screenshot `e2e/screenshots/11-earpath.png`.
- Dev screen is `/dev/screens/ear-path` (not `earpath`), matching the existing `ear-path` fixture key. It lives in `features/earpath/` because the registry only globs `features/*/dev.tsx` and `features/path/dev.tsx` belongs to Task 10. Knobs: `?vis=num|name|all`, `?stage1=done`.
- **Added beyond the design** (docs/decisions.md, Task 11): a compact ShowMeControl row under "How a level works" sets the ear track's `visibility`, which Task 14's drills read. At 1280×820 it pushes "Start Level 3" partly below the fold, and the page scrolls about 20px.
- Several open stages each render as `current` (tangerine node and segments). Only the stage holding `upNext` links its card to `upNext.route`. Locked and done cards are not links. The design links stages 4 and 5, which looks like a prototype leftover.
- "Up next" title is `${stageTitle} · ${title}` and the CTA label is `upNext.label`, both from the engine. "Track · stage N of M" is the stage holding up-next.
- e2e border probe: on 1.5× displays Chromium reports the locked node's 3px border as `2.66667px`, so the probe accepts either value. The 3px rail is probed by width and passes exactly.
