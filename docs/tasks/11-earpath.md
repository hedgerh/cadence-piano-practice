# 11 — EarPath (ladder track map)

**Status:** todo

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
