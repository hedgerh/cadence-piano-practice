# 10 — Path (circle) + Learn + minor track

**Status:** done

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

## Notes

Files: `features/path/{PathPage,PathView,ReviewFinishedKey}.tsx` (+ `PathPage.module.css`, `ReviewFinishedKey.module.css`), `path.ts` (pure view-model helpers), `dev.tsx`, `path.test.tsx`; `features/learn/{LearnPage,LessonView}.tsx` (+ `LearnPage.module.css`), `useLessonPlayback.ts`, `dev.tsx`, `learn.test.tsx`; `e2e/path.spec.ts`, `e2e/learn.spec.ts`; screenshots `10-path.png`, `10-learn.png`. Routing (`TracksRoute`, `/tracks` redirect) was already in place from the route scaffold.

Deviations / beyond the design:

- Shared components got additive optional props: `CircleOfFifths` `innerLabel` (the minor track says "inner ring: relative majors") and per-key `ariaLabel`; `RomanChip` `className` (Learn's sounding highlight).
- Compact (20px) outer labels: the design sets only slot 6 (G♭, Path:110) at 20px while D♭/A♭/E♭/B♭ stay 24px, so the rule is "slot 6, or labels of three or more characters" (the minor track's F♯m, C♯m, G♯m, E♭m, B♭m). ui.md's "two-char labels" wording does not match the design here; I followed the design.
- Opening `/tracks/minor-diatonic-chords` shows the map. It does not auto-redirect to the lesson. The gating sits on the primary CTA ("Start with the lesson" → lesson while `lessonSeen` is false; afterwards "Start A minor" → Practice) and on Today's `lessonFirst` route.
- Not enrolled or paused track ("Ready to start", ui.md §3 / engine.md §6.15): the highlight card eyebrow reads "Ready to start", with the note "Starts with a 1-min lesson" (the same copy as Today's track card). The CTA enrolls via `tracks.setSettings {active:true}` and then goes to the lesson (or starts the session when the track has no pending lesson). A complete track shows a "Complete" card with no CTA. An unavailable track shows "Coming soon".
- "Review a finished key" toggles a flat card (Path:58) under the actions, listing done keys as outlined pills (Path:43 styling, 44px). Picking a pill, or clicking a done circle node, starts a `review` session.
- Sounding chip highlight: the chip lifts 4px and gets a hard `--sh-ink` shadow (combined with the pivot ring on vi/i). The "Hear both patterns" button keeps its label while disabled.
- Audio is scheduled on the synth clock after `unlock()` (chords 0.55 s apart). The highlight and disabled state run on UI timers from the click, so they finish even if the AudioContext stays suspended.
- The header eyebrow "Lesson · about 1 minute" is a renderer constant, because `Lesson` has no duration field.
- `sessions.start` from Path, Review and Learn passively attaches today's matching plan block id when `plan.getToday` is already cached, so Today shows the block in progress. It never fetches the plan itself.

**Task 16 follow-ups.** Learn:40 gives the row label `width: 150px`, but "Major (you know this)" is about 160px at 15/800 and wrapped onto two lines. The width is now a minimum and the label does not wrap. The circle with all 12 keys done shows the existing "Complete · Every key done" card with no CTA (seed `all-complete`, screenshot `16-path-complete.png`).
