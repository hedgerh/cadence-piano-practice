# 15 — Ear: Find the key

**Status:** done

Hear a phrase, hunt for the home note on the real keyboard (tries show faintly, home stays lit), then choose major or minor. MIDI is the answer here.

## Inputs

- `docs/handoff/design/EarKey.dc.html`; `docs/ui.md` §2 (StepCard, OutlineInkButton 60, PianoKeyboard `home`/`tried` states) and §3 row (EarKey, including the step-2 answered feedback the design omits); `docs/engine.md` §1 (`root` match with `then`), §2.2 stage `find-the-key`, §6 default 13–14.
- Reducer from Task 12 (extend with `root: { found, tries[] }`).

## Deliverables

- `KeyDrill.tsx` (+ css): 112px play button ("Hear the phrase" / "Hear the phrase again", sub-copy "Eight notes, about four seconds. Replay as often as you like."), two `StepCard`s (step 1 "Find the home note" → done "Home note: E" + "Found on your third try (you tried G, then A)." / "First try."; step 2 "Major or minor?" with the tip copy), two-octave keyboard (home = every octave of the tonic pitch class in teal; tried = released wrong notes in `--sand`, octave as played; held = `--key-held`), answer row with two `OutlineInkButton` 60 ("E major" / "E minor", disabled until home found) and the underlined "Hint: hear the phrase's last chord" TextButton (plays `step.hint`, marks hinted), step-2 answered feedback panel per ui.md §3, progress with `pass.of` (5) segments and "n right · phrase q of 5".
- Reducer: note-on while `root.found=false` → `reduceMatch(root)`; miss appends to `tries` on release; hit sets `found` and lights home; `PICK` only after `found`; result `clean` iff found within 2 tries and no hint, `hinted` if correct otherwise, `wrong` if the mode is wrong.
- Fixture + `/dev/screens/ear-key?tries=G,A` and `?phase=answered`.
- `e2e/ear-key.spec.ts`: seed `ear-unlocked` (extend so Find the key is open); open L1; press play; via dev MIDI press G3 then A3 (tried) then E4 (home) → assert step-1 copy and that E3 and E4 are teal; pick "E minor"; assert feedback; screenshot `15-ear-key.png`.

## Acceptance

- Pixel-faithful to EarKey.dc.html (step cards, keyboard lighting, 60px outlined ink buttons, 5-segment progress at max-width 300).
- Unlimited tries; hint always available; clean/hinted/wrong recorded per the rule; levels pass at 4/5.
- `pnpm check` and `pnpm e2e` green.

## Out of scope

Polish items (Task 16).

## Notes

Files: `features/ear/KeyDrill.tsx` (+css; `KeyDrill` = live wrapper, `KeyDrillView` = presentational), `keyModel.ts` (copy, lighting, labels), `keyFixtures.ts`, `keyDrill.test.ts`, `features/earkey/dev.tsx` (`/dev/screens/ear-key`, knobs `?tries=G,A` (default) · `?tries=` · `?found=0` · `?phase=answered` · `?chosen=major` · `?hinted=1`), `e2e/ear-key.spec.ts`. Screenshots: `15-ear-key.png` (live), `15-ear-key-answered.png` (live), `15-ear-key-design.png` (dev screen, the design's exact E / G, A state).

Reducer and hook (additive): `ROOT_NOTE` (note-on → `reduceMatch(root)`) and a new `ROOT_RELEASE`; `RootHunt.pending` holds wrong notes until release; `PICK` accepts `root.then` options once `found`. `EarResult.tries` → `recordStep.tries`. `useEarDrill` gets a second `useMidiEvents` listener for root questions and `playHint` (plays `step.hint`, dispatches `HINT`, shares the prompt's busy gate). The dev hook adds `tonicPc`, `answer` and `found`. The seed already opened Find the key (Chords in a key L1–L3), so `seed.ts` is unchanged.

Deviations and new copy:

- **`tries` is the try number home was found on** (1 = first try, 3 = "third try"), not the count of wrong notes.
- **The hunt starts when the phrase starts** (`phase: listening`). Notes played before that are ignored. A wrong note still held when the tonic is hit counts as a try.
- **The live screenshot is in C, not E.** The seeded session's 5 phrases had no E tonic. The e2e uses the first E question when there is one, otherwise question 1. It plays wrong notes a minor 3rd and a 4th above home in octave 3, then home in octave 4, to match the design's layout. `15-ear-key-design.png` shows the exact design state. The MIDI pill in the live shots shows the host machine's real device.
- New states the design doesn't show. Step 1 while hunting: "Play any note. Home is the one the phrase wants to end on." / "Not A. Keep hunting — tries are unlimited." Step 2 before home is found uses a new `StepCard` `upcoming` state: white, `2px --line-strong`, muted numeral in a `3px --line-strong` ring, body "Find home first, then decide." After a right answer, step 2 is done: "Key: E minor" plus how it was scored ("Clean: home in two tries or fewer, no hint." / "Counted as hinted: you heard the last chord." / "Counted as hinted: home took more than two tries."). After a wrong answer, step 2 stays current.
- Tried notes are spelled in the question's key (C major: E♭, F).
- Answered feedback (ui.md §3): "E minor — yes." + `step.explain`, or "Not quite. That was E minor." + explain + "You said major — it will come back in review." The one-octave keyboard lights the tonic triad. `FeedbackPanel.playback` now accepts `null`, which hides the play-back line (phrases have no play-back, §6.11). The panel replaces the answer row. Once answered, the keyboard caption is hidden so the screen fits 820px (the e2e asserts no overflow).
- The hint button is disabled while a sound from the drill is playing (the phrase or the hint chord). Otherwise it is available until the question is answered.
- `StepCard` also gains `data-step` and the `step-title`/`step-body` test ids.
