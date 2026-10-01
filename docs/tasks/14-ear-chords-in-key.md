# 14 — Ear: Chords in a key

**Status:** todo

Hear a cadence, then one chord; answer with the roman-numeral chips used in practice; feedback explains the chord's function.

## Inputs

- `docs/handoff/design/EarChord.dc.html` (answered state); `docs/ui.md` §3 row `/ear/:levelId` (EarChord); `docs/engine.md` §2.2 stage `chords-in-key` (`explain` table), §6 default 4 (chip colors are state-based here as designed).
- `ChoiceDrill` from Task 13; track visibility via `tracks.overview` (the "Show me" setting of the ear track).

## Deliverables

- `ChordDrill.tsx` (or a `ChoiceDrill` variant) with: two-button audio cluster (72px outlined "Hear the key", 112px "Hear the chord" / "Hear the chord again"), prompt "Which chord did you hear?", seven `AnswerChip` 104×68 (numeral + chord short name; name hidden when the track visibility is `num`), caption "Chord names shown — switch to numerals only in Show me, like in practice." (or the numerals-only wording), feedback panel with `min-width 280` and `step.explain` as the body, keyboard lighting the triad's pitch classes.
- The ear track honors `visibility` from `track_settings` (set from Practice's Show-me for the ear track? No — add a small ShowMeControl to the ear drill header right slot? The design has none. Decision: ear drills read the **ear track's** visibility; it is set from EarPath via a compact ShowMeControl under the "How a level works" card. Record this in `docs/decisions.md`).
- Fixture + `/dev/screens/ear-chord?phase=answered`.
- `e2e/ear-chord.spec.ts`: seed `ear-unlocked`; open Chords in a key L2 (G major); answer; assert title "IV — yes, that's C major." and body "The IV chord pulls gently away from home. In G, that's C · E · G."; toggle visibility to `num` and assert names hidden; screenshot `14-ear-chord.png`.

## Acceptance

- Pixel-faithful to EarChord.dc.html's answered state (progress bar with a lavender miss at segment 3; chip states; feedback panel; InkButton Next).
- `explain` copy comes from content, not the renderer.
- `pnpm check` and `pnpm e2e` green.

## Out of scope

Find the key (Task 15).
