# 22 — Jam

**Status:** done on `main` (2026-10-18). E2E and screenshots are pending the owner's go-ahead.

Roadmap phases 3 and 5: play over a looping backing. Ungraded.

## Deliverables

- **Route**: `/jam`, with a **Jam** tab in the header.
- **Presets** (`@cadence/content` `JAM_PRESETS`, `jamChart`): Four-chord pop, Fifties, Canon, ii–V–I, 12-bar blues, Epic minor and Andalusian, each in 12 keys of its mode, with a guide scale.
- **Backing**:
  - `jamTiming` (pure) and `JamTransport`, a look-ahead scheduler that pumps every 25 ms and looks 0.2 s ahead.
  - A left-hand root plus a voice-led right-hand chord, held or pulsed.
  - A metronome click (`Synth.tick`) and one bar of count-in.
  - A tempo from 50 to 160 BPM that takes effect from the next beat.
  - A new progression or key while playing starts the loop over.
- **Guides**: the three-octave keyboard (C3–B5) lights the chord playing now (`chord` key state) and the guide scale (`scale`). Both are switchable.
- **Record and play back**:
  - A take starts at the top of the next loop and lasts 1, 2 or 4 loops.
  - Notes keep their timing and velocity (`playMidi(…, velocity)`).
  - Play back restores the take's progression, key and tempo.
  - The last 5 takes are kept for the visit.
- **Settings** are remembered on this computer (`cadence.jam.v1`).

## Acceptance

- `pnpm check` green.
- Unit tests cover:
  - beat positions, including the 48-beat blues loop;
  - backing events (held, pulse, clicks, count-in);
  - the transport never scheduling a beat twice, tempo changes and bounded runs;
  - takes and their trimming;
  - presets in every key;
  - the page (start/stop, guides, settings).

## Deviations

- There is no design file. The page uses the app's tokens and components: the Interval practice toggle look, Practice's chips and the practice keyboard.
- Takes are not saved to disk.
