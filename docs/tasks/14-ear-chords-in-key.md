# 14 — Ear: Chords in a key

**Status:** done

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

## Notes

No new drill component. Chords in a key is a fourth `ChoiceDrill` stage kind, `numerals` in `choiceModel.ts` (`stageKindOf('chords-in-key')`). The shell already had the two-button cluster from Task 13. Files: `choiceModel.ts` (`chordShort`, `chordNamesShown`, `numeralsCaption`, `feedbackMinWidth`, a `LabelContext` argument on `optionLabel`, the `numerals` branches of `chipSize`/`feedbackCopy`/`stageCopy`), `ChoiceDrill.tsx` (+css: `visibility` prop, caption EarChord:83, panel `minTextWidth`), `EarDrillPage.tsx` (visibility from `tracks.overview`, with the session's `visibility` as fallback), `dev.tsx` (`ear-chord`, `?phase=answered`, `?visibility=num`). Tests: `choiceModel.test.ts` (labels in G major and A minor, visibility, copy, lighting, play-back) and `e2e/ear-chord.spec.ts`. Screenshot `14-ear-chord.png`. `earDrillReducer.ts` and `useEarDrill.ts` are unchanged.

Deviations and new copy:

- Chip names come from `diatonicTriads(question.context key)` in `@cadence/music`, because options are plain numerals. The feedback title uses the step's `name` ("C major"). The body is `step.explain` from content.
- Visibility: only `num` hides names. `name` and `all` show both lines, since the numeral is the answer. Numerals-only caption (new): "Numerals only — switch chord names back on in Show me, like in practice."
- Wrong answer (not in the design): title "Not quite. That was IV — C major."; body = explain + " You said ii — it will come back in review." The chosen-wrong chip is tangerine tint with a `--tangerine-deep` border, and the correct chip is teal (state colors, no quality colors).
- Greyed-out options (L1 has four active) add "Greyed-out chords arrive in later levels." under the caption while listening.
- `AnswerChip` change (additive): an empty `secondary` renders no second line, so a numerals-only chip centers its numeral.
- Session question order is random. The e2e answers 5 questions (miss at 3) to reproduce the design's progress bar, then checks the title and body against whichever step comes 6th. It checks the literal IV-in-G copy against content. The answered screenshot shows that random 6th chord. `/dev/screens/ear-chord?phase=answered` is the exact IV design state.
