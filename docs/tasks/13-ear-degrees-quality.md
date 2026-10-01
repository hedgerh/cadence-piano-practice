# 13 — Ear: Scale degrees + Chord quality

**Status:** done

Two stages that reuse the interval drill shell: scale degrees (with a "Hear the key" cadence button and single-note prompts) and chord quality (one chord, three options).

## Inputs

- `docs/engine.md` §2.2 (stage level tables), §5, §7 (cadence voicing/timing); `docs/ui.md` §2 (PlayButton 72 outlined for context sounds — see EarChord.dc.html lines 59–63 for its styling).
- Reducer and page from Task 12.

## Deliverables

- Generalize `IntervalDrill` into `ChoiceDrill.tsx` driven by the step: optional `context` sound → 72px outlined "Hear the key" button (plays `cadence`), main 112px button plays `step.play`, answer chips from `match.options` with `activeOptions` gating, labels from a per-stage label map (`'1'..'7'` → "1" / "Tonic"… keep it to the digit plus a short name: 1 Tonic, 2 Supertonic, 3 Mediant, 4 Subdominant, 5 Dominant, 6 Submediant, 7 Leading tone; `major`/`minor`/`diminished` → "Major" / "Minor" / "Diminished" with quality-colored chips when answered).
- Feedback copy templates per stage (degrees: "3 — yes. That's E in C major." / "Not quite. That was 3, the mediant."; quality: "Minor — yes." / "Not quite. That was a diminished chord.") with the one-octave keyboard lighting the sounding note(s) teal.
- Play-back detection: single note (any octave) for degrees; pitch-class set for chords.
- Fixtures + `/dev/screens/ear-degrees`, `/dev/screens/ear-quality`.
- `e2e/ear-stages.spec.ts`: seed a scenario with Intervals L5 passed (add `'ear-unlocked'` seed in core) so both stages are open; play through one question of each; assert the cadence button exists only for the degrees stage; screenshots `13-ear-degrees.png`, `13-ear-quality.png`.

## Acceptance

- Both stages playable end to end with dev MIDI; cadence plays I–IV–V–I in the level's key (~3 s) and the main prompt is gated until it finishes when the cadence is auto-played for the first question in a key.
- Unlock chain: passing Intervals L3 opens Scale degrees (`{intervals,4}`); passing Intervals L4 opens Chord quality (`{intervals,5}`).
- `pnpm check` and `pnpm e2e` green.

## Out of scope

Chords in a key (Task 14), Find the key (Task 15).

## Notes

Built together with Task 12 (see its notes for files and shared deviations). Tests: `choiceModel.test.ts` (labels, copy, lighting, play-back specs, cadence gating) and `e2e/ear-stages.spec.ts`. Screenshots `13-ear-degrees.png`, `13-ear-quality.png`. The `ear-unlocked` seed already existed in core.

Deviations and new copy:

- Degrees: eyebrow "Key of C major" (from the question's cadence). The prompt sits above the chips, EarChord style: "One note in the key. Which degree is it?". Main button: "Play the note" / "Hear the note again". Wrong-answer body: "That's E in C major. You said 5, the dominant — it will come back in review."
- Quality: chips use the new `wide` AnswerChip (150×64, interval type sizes) so "Diminished" fits. The second line is the stacked 3rds ("M3 + m3" / "m3 + M3" / "m3 + m3"). The correct chip fills with `qualityColor`; the chosen-wrong chip stays tangerine tint. Correct body = `step.explain`. Wrong body = its first sentence + "You said minor — it will come back in review."
- Context layout follows EarChord:57–73: a 72px outlined button beside the 112px one, with the question line above the chips. The cadence auto-plays only for the first question in each key (one per distinct `context` Sound per drill mount), then the prompt. Answers stay disabled until both finish. The e2e checks the gate is still closed at 2 s. A replay plays only the prompt. "Hear the key" plays the cadence on its own.

For Tasks 14/15:

- **ChoiceDrill** is driven by `stageKindOf(stage.id)` in `choiceModel.ts`. `chords-in-key` currently falls into `generic`: raw option labels, interval-size chips, generic copy. The cadence button and play-back (pitch-class `chord` match) already work. Task 14 should add a `numerals` kind in `choiceModel.ts`: `optionLabel` = numeral + chord name, respecting the ear track's `visibility` from Task 11; `chipSize` → `'chord'` (104×68); feedback "IV — yes, that's C major." + `step.explain`. The shell should not need changes.
- **Reducer**: `root: { found, tries }` exists and `ROOT_NOTE` is a no-op placeholder. `PICK` only accepts `choice` matches; Task 15 must extend it for `root.then` (major/minor). `HINT` sets `hinted`, so a correct pick records `hinted`. `answersEnabled` = `listening && played`. `PLAY_START`/`PLAY_END` carry `q`, so stale ends are ignored.
- **useEarDrill** handles auto-play, recordStep (retried), recordPlayback (once, after that ordinal's recordStep), finish → `/ear/results/:id` with `{ complete }` router state, and the dev hook. `playbackSpec` returns null for `phrase`/`cadence`, so Find the key gets no play-back. Task 15 can reuse the hook and add root-hunt MIDI handling (`useMidiEvents` → `ROOT_NOTE`).
- **KeyDrill** (`features/ear/KeyDrill.tsx`) is a stub: `{ session, backTo }`. It renders "Find the key arrives in Task 15." `EarDrillPage.drillKindOf` routes any level whose first question has a `root` match to it.
