# 20 — Songs, Name the progression, and 7th chords

**Status:** done on `main` (2026-10-18). E2E and screenshots are pending the owner's go-ahead (they open app windows).

These are items 3 and 4 on the track backlog, roadmap phase 2: the progressions of real songs, hearing progressions, and 7th chords.

## Inputs

- `docs/roadmap.md` phase 2.
- decisions.md 2026-10-10 "Voice leading": the `progression` match and `freeBass`.

## Deliverables

- **Music**:
  - `diatonicSevenths(key)` gives Imaj7, ii7, iii7, IVmaj7, V7, vi7 and viiø7; minor keys work too.
  - `chordSymbolOf(notes)` names a chord from its notes.
  - `placeChord` drops a hint an octave when a 4-note chord would pass B4.
- **Content**:
  - **Songs** (12 major keys, both hands, ★ marks the original key): Let It Be (2 lines), Don't Stop Believin' (2), Stand By Me, Someone Like You (V/3 bass), Canon in D (2).
  - **Diatonic 7th chords** (7 chords per key, any octave or inversion).
  - **ii–V–I** (6 four-voice smooth progressions per key, right hand and with a left-hand root). Every 7th falls to the next 3rd.
  - **Name the progression**, a new ear stage: 4 levels, 2 → 5 progressions, unlocked after passing Chords in a key level 3.
  - The `chords` sound.
  - A shared `progressionStep` builder in `generators/levelBits.ts`, with figured-bass chips (V⁶, ii7⁶₅).
- **Engine and renderer**:
  - The `chords` sound in the player, the ear model and the lesson tiles.
  - A `progressions` stage kind: wide chips with nicknames, its own prompt and feedback copy.
  - 7th chords named in strips, skip copy and review.
  - Track-map chips match 7ths.
  - Copy: plan "all 7 diatonic 7th chords" and completion "All seven 7th chords."

## Acceptance

- `pnpm check` green. The validator proves all 36 new circle levels are in key, solvable at ≤ 2 semitones per voice, and on the keyboard.
- Unit tests cover:
  - the 7ths (spelling, symbols, hint placement);
  - the four-voice ii–V–I path;
  - the songs (★, the E/G♯ bass);
  - the ear stage (options, nicknames, voice-led spelled chords);
  - `chords` scheduling.

## Out of scope

- Minor-key songs and 7ths.
- Secondary dominants.
- Play-back XP for progressions.
- Rhythm (Jam).
- Melodies or lyrics: only chord progressions are used.

## Deviations

- None from the design files.
- Name the progression uses the ear drill layout with the wide chips of the chord-quality stage.
