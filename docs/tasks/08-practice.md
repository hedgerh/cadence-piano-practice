# 08 — Practice

**Status:** todo

The core loop: roman numeral, chord name, two-octave keyboard, MIDI listening, Show-me visibility, two-step hint ladder, mark-as-played, skip, finish.

## Inputs

- `docs/handoff/design/Practice.dc.html` (source of truth; its `<script>` is the state pseudo-code), `docs/ui.md` §3 row `/practice/:levelId`, `docs/engine.md` §5 (practice reducer), §6 defaults 1–7.
- `@cadence/music` `reduceMatch`, `hintFor`; channels `content.track`, `tracks.overview` (visibility), `tracks.setSettings`, `sessions.start`, `sessions.get`, `sessions.recordStep`, `sessions.finish`.
- Components: TaskHeader, SegmentedProgress, ShowMeControl, NoteChips, PianoKeyboard, ListeningIndicator, OutlineInkButton, TextButton, RomanChip (state mode), PrimaryButton.

## Deliverables

- `renderer/features/practice/practiceReducer.ts` (pure; `PracticeState`, `PracticeAction`, `practiceReducer`, `initialPracticeState(session)`), `usePracticeSession.ts` (effects: MIDI subscription → `HELD_CHANGED`, 600 ms flash timer, `recordStep` posts with retry, visibility mutation), `PracticePage.tsx` + css, `MidiStateBanner.tsx` (no-device / requesting / denied variants per ui.md).
- Route `/practice/:levelId` (query `session`, `block`); resume via `sessions.get` when a session id is present or stored for the level.
- Fixture + `/dev/screens/practice` with knobs `?hint=0|1|2&vis=num|name|all&midi=none|denied&finished=1`.
- Reducer tests (table-driven): match → matched → advancing → next; `armed` gating (held chord does not match the next step until released); hint labels and disabled at 2; first skip queues, second skip resolves `skipped`; mark-as-played resolves `marked`; timer starts on first note-on or first action; finished when order and queue are exhausted.
- `e2e/practice.spec.ts`: seed `day8`, open A major, drive `window.__cadenceDev.midi` to play all seven chords (include one inversion and one doubling), assert auto-advance and the "All seven. Nice." finish; probe numeral 104px, keyboard metrics, hint button; screenshots `08-practice.png`, `08-practice-hint2.png`.

## Acceptance

- Pixel-faithful to Practice.dc.html in `vis=all`, chord 3 of 7, no hint (default fixture) and with hint 2 (keys lit tangerine).
- Hint 1 shows note-name chips from `hintFor(...).names` with ♯/♭; hint 2 lights `hintFor(...).keys`; held keys light `--key-held`; a correct match flashes the target keys teal for ~600 ms then advances.
- Show-me persists per track via `tracks.setSettings` and is restored on reload; footer strip only in `all`.
- Mark-as-played hidden while a MIDI device is connected (unless `showMarkPlayedAlways`); MIDI state variants render.
- Reload mid-level resumes at the same chord with done/skipped preserved.
- "Finish the key" calls `sessions.finish` and navigates to `/complete/:sessionId` with the DTO in router state.
- `pnpm check` and `pnpm e2e` green.

## Out of scope

Complete screen (Task 09) — the finish navigation may land on a stub.
