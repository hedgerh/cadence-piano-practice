# 02 — `@cadence/content`

**Status:** done

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

## Notes

- **Level blurbs** join the key-signature accidentals with `·` ("Three sharps: F♯ · C♯ · G♯. Chords: …") to match the Path.dc.html "Up next" card that Task 10 asserts; engine.md §2.2's literal `keySignatureText` would give commas. Plan-block blurbs (engine.md §4) still use `keySignatureText` directly.
- **`LessonRow.key`** (+) added so validator rule 7 knows which key a chip row refers to. `Lesson.bridge` marks bold with `**vi**`.
- **Key-based side tracks** (`minor-scales`, `inversions-voice-leading`) use `map: 'circle-of-fifths'`; validator rule 5's "7 steps with numeral labels" applies only to levels whose steps are all `chord` matches. Their level ids are `${keySlug}-scale` / `${keySlug}-inversions` (global uniqueness). Inversion labels are `I`, `I⁶`, `I⁶₄`; voicings place the bass with the hint rule (D3..C♯4), so all stay in C3..B4.
- **Ear levels** have `steps: []` and everything in `pool`; titles are "Level N". Single-key ear levels (scale-degrees L1–L3, chords-in-key L1–L2) also carry `key`. A scale-degree prompt is a one-note `notes` sound with `gapMs: 0`.
- **Phrase seed** is the step's progress key (`${levelId}/${stepId}`), not the bare step id, so the same key gets different phrases in L1/L2/L3. Phrases are rejection-sampled walks (deterministic per seed).
- **Chord-quality spelling**: roots use the default keyboard spelling; triads needing a double accidental fall back to the enharmonic root (E♭° → D♯ F♯ A, A♭° → G♯ B D). Step ids keep the original root slug.
- **Explain copy**: intervals "C up to F." (P1 "C, then C again.", P8 "… to the next C."); chords-in-key uses a 14-entry `CHORD_EXPLAIN` table (IV verbatim from EarChord.dc.html), `{key}` = "G" for major, "A minor" for minor.
- `validateTracks` first zod-parses the tracks; on a schema failure it returns only the schema issues (paths in the same `tracks[i]…` format).
- Tests are colocated in `src/` (like `@cadence/music`); `src/testUtils.ts` holds shared test helpers and is not exported.
