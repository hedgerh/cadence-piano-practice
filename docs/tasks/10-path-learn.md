# 10 — Path (circle) + Learn + minor track

**Status:** todo

The circle-of-fifths track map, the review-a-finished-key flow, the lesson screen with audio, lesson-seen gating, and enrolling the minor track.

## Inputs

- `docs/handoff/design/Path.dc.html`, `Learn.dc.html`; `docs/ui.md` §2 (TrackPills, CircleOfFifths, LegendSwatches, Callout) and §3 rows `/tracks/:trackId`, `/tracks/:trackId/lesson`; `docs/engine.md` §4 (trackOverview, nextLevel, lesson-seen), §2.1 `Lesson` type.
- Channels: `content.tracks`, `content.track`, `tracks.overview`, `tracks.lessonSeen`, `tracks.setSettings`, `sessions.start`.
- Audio: `useAudio().playMidi` / `player` for "Hear both patterns".

## Deliverables

- `renderer/features/path/PathPage.tsx` (+ css), `ReviewFinishedKey.tsx` (flat card listing done keys → `sessions.start({kind:'review'})`), route `/tracks/:trackId` dispatching to PathPage for `map:'circle-of-fifths'` (LadderPathPage comes in Task 11; stub until then), `/tracks` redirecting to the first active track.
- `renderer/features/learn/LearnPage.tsx` (+ css), `LessonView.tsx` rendering the structured `Lesson` (rows of RomanChip quality mode h52 with `pivot` → emphasized ring, Callout bridge, legend), "Hear both patterns" playing `lesson.hear.sounds` sequentially at 0.55 s spacing with the sounding chip highlighted and the button disabled while playing; "Got it — play A minor" → `tracks.lessonSeen` then `sessions.start` → Practice.
- Minor track in Today/Path: "Ready to start" card → enroll on click → Learn first (because `lessonSeen` is false) → `a-minor` practice with `i ii° III iv v VI VII`.
- Fixtures + `/dev/screens/path`, `/dev/screens/learn`.
- `e2e/path.spec.ts`: seed `day8`; probe circle node positions/sizes against Path.dc.html's hardcoded `left/top` (within 1px), pill states, "Up next" card copy "Three sharps: F♯ · C♯ · G♯. Chords: A · Bm · C♯m · D · E · F♯m · G♯°"; click a done node → review session starts; `e2e/learn.spec.ts` asserts the two chip rows and that the play button disables while playing (NullSynth not available in e2e — assert the disabled state only); screenshots `10-path.png`, `10-learn.png`.

## Acceptance

- Pixel-faithful to Path.dc.html and Learn.dc.html (chip colors via `qualityColor`; Learn legend 12px/r4 vs Path 10px/r3; "Up next" card tint/border; secondary button shadow).
- Circle shows done/current/upcoming correctly for both chord tracks (minor track: outer ring minor labels, inner ring relative majors).
- Lesson gating works once (second entry to the minor track goes straight to Practice).
- `pnpm check` and `pnpm e2e` green.

## Out of scope

Ladder path (Task 11).
