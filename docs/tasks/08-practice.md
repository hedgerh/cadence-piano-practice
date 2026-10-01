# 08 — Practice

**Status:** done

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

## Notes

Files: `renderer/features/practice/{practiceReducer,practiceSelectors,retry,usePracticeSession}.ts`, `{PracticePage,PracticeView,MidiStateBanner,dev}.tsx` + css; `practiceReducer.test.ts` (40 cases); `e2e/practice.spec.ts`; screenshots `08-practice.png`, `08-practice-hint2.png`. The UI derivations live in `practiceSelectors.ts` (a `practiceView.ts` would collide with `PracticeView.tsx` on a case-insensitive filesystem).

Deviations from Practice.dc.html / decisions taken:

- **Mark as played** (engine.md §6.3): hidden while a device is connected unless `showMarkPlayedAlways` (then the Practice:112 text link); `requesting` keeps the text link; no-device / denied / unsupported promote it to an OutlineInkButton "Mark as played". The dev screen passes `showMarkPlayedAlways` so its default matches the design (link beside a connected pill).
- **MidiStateBanner** replaces the Practice:102 Listening line when not connected: requesting (pulsing dune dot, "Looking for keyboards…"), no-device ("No keyboard found — plug one in, or play on your computer keys"), denied (help card "MIDI access blocked" with Windows privacy steps). Copy is new; no red.
- **Teal flash** lights the keys actually played (the notes that matched), not the hint voicing, so inversions/doublings flash where the hands are.
- **Strip / segments**: hinted and marked steps show `done` (Practice has no hinted state; engine.md §6.4). Once-skipped (queued) steps and resolved skips show the dashed `skipped` chip; segments stay empty for skips (Practice:184).
- **Finished copy with skips** (ui.md §3): "Five of seven. Nice." / "Bm and G♯° come back tomorrow." ("comes" for one).
- **Eyebrow** generated as `<Kind> · <track title without Major/Minor>` → "Learn · diatonic chords"; tone by kind (learn tangerine, review lavender, warm-up/free teal).
- **recordStep** is posted as soon as a step resolves (not on `advancing`), retried in memory at 250/1000/3000 ms; "Finish the key" waits for in-flight posts and retries failures once before `sessions.finish`, showing a muted error line if it still fails.
- **Resume**: without `?session=`, `sessions.start` runs (kind/planBlockId from `?block=` or today's open block for the level, else `learn`; the engine itself resumes today's unfinished session) and `?session=` is written into the URL; with it, `sessions.get`. The once-skipped queue is not persisted, so after a reload queued steps return to level order (resolved results, including skips, are preserved).
- **Timer**: `Date.now()`; `durationMs` = resumed results' `elapsedMs` + the live span from the first note-on/hint/skip/mark to the last resolve.
- **Finish navigation** passes router state `{ complete: CompleteDto }` (`CompleteRouteState` in `usePracticeSession.ts`) for Task 09.
- Loading / error placeholder ("Getting your keys ready…") is not in the design.
