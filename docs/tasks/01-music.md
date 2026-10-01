# 01 — `@cadence/music`

**Status:** todo

Pure TypeScript music theory and matching. Zero dependencies. Used by both the renderer (real-time grading) and main (validation).

## Inputs

- `docs/engine.md` §1 (function signatures, rules, test tables) — implement exactly.
- `docs/handoff/HANDOFF.md` §4 `Match` union and §5 MIDI rules.
- `docs/handoff/design/Practice.dc.html` lines 139–151: the design's hint voicings and keyboard layout the placement rule must reproduce.

## Deliverables

`packages/music/src/`:

- `pitch.ts` — `PitchClass`, `Note`, `Midi`, `Pc`, `noteToMidi`, `midiToPc`, `midiOctave`, `midiToNote`, `midiToFrequency`, `pretty`, `inRange88`, `pcName(pc, spelling)`.
- `keys.ts` — `Key`, `CIRCLE_MAJOR`, `CIRCLE_MINOR`, `scale`, `keySignature`, `keySignatureText`, `relativeMinor`, `relativeMajor`, `keyTitle`, `keySlug`.
- `triads.ts` — `Triad`, `diatonicTriads`, `MAJOR_NUMERALS`, `MINOR_NUMERALS`, `triadName`.
- `intervals.ts` — `INTERVALS` (13), `intervalBetween`, `transpose`.
- `voicing.ts` — `PRACTICE_RANGE`, `placeRoot`, `placeTriad`, `triadNotes`, `placeScale`, `cadenceVoicing`.
- `match.ts` — `MatchSpec`, `MatchStatus`, `MatchState`, `MatchInput`, `initialMatchState`, `reduceMatch`, `hintFor`.
- `index.ts` re-exporting everything.
- Tests next to each module (`*.test.ts`), per `docs/engine.md` §1.T.

## Acceptance

- `diatonicTriads` is correct for all 24 keys; hand-written expected tables for C, A, G♭, B major and A, E♭, G♯ minor pass (E♭ minor → `Ebm F° Gb Abm Bbm Cb Db`).
- `keySignatureText({tonic:'A', mode:'major'})` → `"Three sharps: F♯, C♯, G♯."`; C major → `"No sharps or flats."`.
- `placeTriad` reproduces the design voicings exactly: A major `[57,61,64]` (A3 C♯4 E4), D major `[50,54,57]`, C♯ minor `[61,64,68]`, G♯ dim `[56,59,62]`.
- Matcher table: C major matched by `E3 G3 C4`, by `C4 E4 G4 C5` (doubling), `partial` on `C4 E4`, `wrong` on `C4 E4 G4 A4`; voicing rejects an inversion; sequence resets silently on a wrong note and restarts at index 1 when the wrong note equals `target[0]`; root matches any octave and chains into `then`.
- `hintFor(chord)` returns spelled names in root/3rd/5th order and keys equal to `placeTriad`; `hintFor(choice)` is `null`.
- `midiToFrequency(69) === 440`; `midiToFrequency(60)` ≈ 261.63.
- `pnpm check` green; every exported function has at least one test.

## Out of scope

Content generation (Task 02), persistence, UI.
