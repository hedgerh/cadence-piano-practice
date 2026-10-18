# 21 — Minor progressions, pentatonic & blues scales, 12-bar blues

**Status:** done on `main` (2026-10-18). E2E and screenshots are pending the owner's go-ahead.

## Deliverables

- **`Level.extraNotes`**: the out-of-key notes a level uses on purpose. The validator checks they are really outside the key.
- **Minor progressions** (12 minor keys, A♭ minor for G♯ minor): 8 smooth progressions with the harmonic-minor V. Moves into V from iv or ii° may be a minor 3rd.
- **Pentatonic scales** (12 major keys): the major pentatonic and its relative minor pentatonic, up and down.
- **Blues scale** (12 minor keys, group "Blues"): up and down, with the flat 5th declared.
- **12-bar blues** (12 major keys, F♯ for G♭): the I7, IV7 and V7 shapes, smooth 4-voice moves, the form with one hand and with a left-hand root, and the quick change.
- **Music**:
  - `harmonicMinorScale`, `harmonicTriads`, `triadsOn`, `spellableMinor`;
  - `majorPentatonic`, `minorPentatonic`, `bluesScale`, `flatFive`, `placeRun`;
  - `dominantSeventhOn`.
- A lesson for each track.

## Acceptance

`pnpm check` green. The validator proves every new level is in key apart from its declared extra notes, solvable within its `maxMove`, and on the keyboard.

## Deviations

- G♯ minor and G♭ major can't be spelled without double accidentals in these tracks, so their circle slots use A♭ minor and F♯ major.
