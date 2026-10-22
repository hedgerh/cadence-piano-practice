# 23 — Songs from MIDI

**Status:** done on `main` (2026-10-21). E2E and screenshots are pending the owner's go-ahead. First song: _Delilah (pull me out of this)_ (The Theorist piano cover, the owner's own file).

Learn real songs exactly as written (which hand, which inversion, which octave), then play along in time.

## Deliverables

- **Reading MIDI**: `@cadence/music` `parseMidi`, a Standard MIDI File reader for formats 0 and 1, with running status, the sustain pedal, tempo and meter. `songFromMidi` turns it into a song: notes in beats, two hands taken from the file's parts (never from a split point), bar lines across meter changes, and the pedal.
- **Saving**: IPC channels `songs.list`, `songs.get`, `songs.import` (base64 bytes) and `songs.delete`. Main reads the file once and saves JSON in `userData/songs/`. A file that isn't MIDI is refused with a readable reason.
- **Screens**: Jam gets two tabs, **Progressions** and **Songs**.
  - `/jam/songs` has **Import MIDI** and the song list.
  - `/jam/songs/:id` has two modes:
    - **Wait for me**: the exact keys of each step are lit, left hand teal and right hand tangerine. The song moves on only when every key is struck. A wrong key turns lavender and is named. The status shows the bar and beat, each hand's notes, a chord name as a guide, and the pedal. The other hand can play itself between your steps.
    - **Play along**: the song in time at 25–100% speed, looping the chosen bars, with a bar of count-in. Optional: the click, and your own part.
  - Both modes let you choose the hand(s) and the bars.
- **Keyboard**: `PianoKeyboard` takes an octave count. Song keyboards cover the song's full range and scale to fit.

## Acceptance

- `pnpm check` green.
- Unit tests cover:
  - the reader (running status, velocity-0 offs, pedal, meters, format 0);
  - the song (hands by part, bars across a 2/4 bar);
  - the store (import, list, get, delete, refusals);
  - timing through tempo changes, steps, Wait grading, the pedal, chord names and the player (speed, loop, count-in);
  - the screens.
- Checked against the owner's Delilah file: 98 bars, the 2/4 bar 17, 747 left-hand and 1,029 right-hand notes, 53 pedal changes.

## Deviations

- There is no design file. The screens use the app's tokens and the Jam look.
- Songs are not part of tracks, XP or the plan.
- Imported files are never bundled with the app.
