# Cadence

Daily music-theory practice for a beginner pianist with a MIDI keyboard. Think Duolingo for theory, with no tempo pressure. Windows desktop app built with Electron, React and SQLite.

**Status:** scaffold complete; screens and engine are being built task by task (see `docs/tasks/`).

## Requirements

- Windows 10/11, x64.
- A USB MIDI keyboard (optional: every chord can be marked as played by hand).
- For development: Node ≥ 22.12 and pnpm 12 (`npm i -g pnpm`).

## Development

```bash
pnpm install
pnpm dev        # Electron with renderer hot reload
pnpm check      # typecheck + lint + format + tests
pnpm e2e        # build, then Playwright drives the real app
pnpm dist       # NSIS installer into apps/desktop/dist
```

The installer is unsigned; Windows SmartScreen will show "Windows protected your PC" → **More info → Run anyway**. App data lives in `%APPDATA%\Cadence`.

## Repository

- `apps/desktop` — Electron main, preload, React renderer, Playwright e2e.
- `packages/music` — pure music theory and MIDI matching.
- `packages/content` — the tracks the learner practices (generated, validated).
- `packages/core` — the engine: today's plan, review scheduling, XP, streaks.
- `packages/db` — Drizzle schema, migrations, repositories.
- `docs/` — handoff from design, architecture, engine rules, UI system, decisions, and the task backlog.

Start with `CLAUDE.md` if you are an agent, or `docs/architecture.md` if you are a human.
