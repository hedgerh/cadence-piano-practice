# 02 — `@cadence/content`

**Status:** todo

The content model (zod), the track generators, the lesson, the phrase generator, and the validator. Content is generated at runtime from code; a snapshot of all step ids guards progress rows.

## Inputs

- `docs/engine.md` §2 (types, generators table, phrase rules, validator rules) — implement exactly.
- `docs/handoff/HANDOFF.md` §4 (content model) and the first-tracks paragraph.
- Designs for authored copy: `Learn.dc.html` (lesson rows, pivot, bridge, CTA), `EarPath.dc.html` (stage titles/blurbs/unlock copy), `EarChord.dc.html` (explanation copy style), `EarInterval.dc.html` (interval names and level 3 set).
- `@cadence/music` from Task 01.

## Deliverables

`packages/content/src/`:

- `types.ts` — zod schemas + inferred types: `Track`, `Stage`, `Unlock`, `Level`, `Step`, `Sound`, `Lesson`, plus `MatchSpec` re-exported from music.
- `ids.ts` — `stepKey(levelId, stepId)`, `numeralAscii(numeral)` (`vii°` → `viidim`).
- `generators/keyTrack.ts` — `majorDiatonicChords()`, `minorDiatonicChords()`.
- `generators/scaleTrack.ts` — `minorScales()` (`available:false`).
- `generators/inversionsTrack.ts` — `inversionsVoiceLeading()` (`available:false`).
- `generators/earTrack.ts` — `earTraining()` with the five stages and level progressions from the table; `generators/phrase.ts` with mulberry32 seeded phrases; `explain` table for the 14 numerals.
- `lessons/minorPattern.ts` — the `Lesson` for the minor track from Learn.dc.html.
- `validate.ts` — `validateTracks(tracks): ValidationError[]` with `{ path, message }` entries.
- `index.ts` — `buildTracks(): Track[]` (all five, in display order: major, minor, minor-scales, inversions, ear) and re-exports.
- Tests: generator expectations, validator negatives, and `tracks.snapshot.test.ts` snapshotting every `stepKey`.

## Acceptance

- `validateTracks(buildTracks())` returns `[]`.
- `a-major` level has seven steps whose `name`/`label` match Practice.dc.html lines 140–146 and whose hint keys (via `hintFor`) equal the design voicings.
- Minor track's first level is `a-minor` with labels `i ii° III iv v VI VII`; `lesson` present with pivot on `vi` (row 1) and `i` (row 2).
- Ear track: stages `intervals`(6 levels) → `scale-degrees`(4) → `chord-quality`(3) → `chords-in-key`(4) → `find-the-key`(3) with unlocks `{intervals,4}`, `{intervals,5}`, `{scale-degrees,4}`, `{chords-in-key,3}`; intervals L3 `activeOptions` = `P1 M2 m3 M3 P4 P5 P8`; find-the-key levels have `pass {4,5}`.
- Phrases are deterministic (same output on two builds), 8 notes, within 55..79, ≥3 chord tones, L1–L2 end on the tonic.
- Validator negatives: a non-diatonic note, a duplicate step id, an out-of-range note, a missing unlock target, `choice.answer ∉ options` — each fixture yields exactly one error whose `path` points at the fault.
- Snapshot of all step keys committed; `pnpm check` green.

## Out of scope

Persistence, services, UI. Do not hand-write the 24 key levels; generate them.
