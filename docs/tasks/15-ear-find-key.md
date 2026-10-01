# 15 — Ear: Find the key

**Status:** todo

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
