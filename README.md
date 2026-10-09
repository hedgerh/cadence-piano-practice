# Cadence

Cadence is a daily music-theory practice app for a beginner pianist. Think Duolingo for theory, with no tempo pressure. Each day it plans about ten minutes: a warm-up, one new key or ear-training level, and a review of whatever is due. You play the chords on a MIDI keyboard and Cadence listens. It hints when you are stuck, schedules your misses for review, and keeps an XP total and a daily streak.

What you can practice today:

- **Major diatonic chords**: all seven chords in each major key, clockwise around the circle of fifths.
- **Minor diatonic chords**: the same pattern in natural minor, with a one-minute lesson first.
- **Ear training**: intervals, scale degrees, chord quality, chords in a key, and finding the key of a phrase.

It is a Windows desktop app (Electron, React, SQLite). It runs fully offline and has no account.

## Requirements

- Windows 10 or 11, 64-bit.
- A USB MIDI keyboard is **optional**. Without one, every chord can be marked as played, and the computer keyboard plays notes: the home row `A S D F G H J K L ;` is C4–E5, the row above is the black keys, and `Z` / `X` shift the octave.

## Install

1. Download `Cadence Setup x.y.z.exe` and run it.
2. The installer is not code-signed, so Windows SmartScreen shows "Windows protected your PC". Click **More info → Run anyway**.
3. Choose an install folder and finish. Cadence appears in the Start menu.

Plug in your keyboard before or after launching; Cadence notices it either way. With more than one MIDI device connected, click the keyboard pill in the top-right corner to choose one. Cadence remembers the choice.

Once you finish a key's seven chords, Cadence moves on to the next key by itself, so you can stay at the piano. Play any key on the Complete screen to go on straight away, or untick **Keep going automatically** there to wait for a click instead.

## Where your data lives

Everything is stored in `%APPDATA%\Cadence`:

- `cadence.sqlite`: your profile, progress, review schedule, XP and streak.
- `logs\main.log`: the app log, useful in bug reports.

Uninstalling removes the app but keeps this folder. Delete it by hand to start over.

## Development

You need Node ≥ 22.12 and pnpm 12 (`npm i -g pnpm`). Use pnpm only, never npm or yarn.

```bash
pnpm install          # also downloads Electron and the SQLite prebuilt
pnpm dev              # Electron with renderer hot reload
pnpm check            # typecheck + lint + format:check + unit tests (Vitest)
pnpm test             # unit tests only
pnpm format           # Prettier
pnpm e2e              # build, then Playwright drives the real app with a throwaway profile
pnpm dist             # NSIS installer into apps/desktop/dist
pnpm db:generate      # Drizzle migration after editing packages/db/src/schema.ts
pnpm rebuild:native   # after bumping Electron: rebuild better-sqlite3 for its ABI
```

The first `pnpm dist` may need Windows Developer Mode (electron-builder's cache uses symlinks).

### Repository

| Path               | What                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| `apps/desktop`     | Electron main, preload, React renderer, Playwright e2e and screenshots. |
| `packages/music`   | Pure music theory: pitches, keys, triads, intervals, MIDI match rules.  |
| `packages/content` | The tracks the learner practices (generated from code, validated).      |
| `packages/core`    | The engine: today's plan, sessions, review scheduling, XP, streaks.     |
| `packages/db`      | Drizzle schema, migrations and the repositories behind `core`'s ports.  |

Adding or changing what the learner practices means editing `packages/content` only.

## Documentation

All design and engineering docs live in [`docs/`](docs/):

- `docs/handoff/`: the original product handoff and the screen designs.
- `docs/architecture.md`, `docs/engine.md`, `docs/ui.md`: how the app is put together, the engine rules, and the UI system.
- `docs/decisions.md`: the decisions log.
- `docs/tasks/`: the build backlog, one file per task, with notes on every deviation from the designs.

If you are an AI agent working in this repo, start with [`CLAUDE.md`](CLAUDE.md).

## Credits

The piano sound uses samples from the [Salamander Grand Piano V3](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) (see `apps/desktop/src/renderer/audio/piano/README.md`).

## License

Cadence is released under the [MIT License](LICENSE). The bundled piano samples keep their own license (CC BY 3.0, see Credits above).
