# 13 — Ear: Scale degrees + Chord quality

**Status:** todo

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
