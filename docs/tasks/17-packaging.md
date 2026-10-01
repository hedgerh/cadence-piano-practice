# 17 — Packaging verification

**Status:** todo

Prove the installer works for a user who has never seen the repo.

## Inputs

- `apps/desktop/electron-builder.yml`, `docs/architecture.md` §6, `CLAUDE.md` Windows notes.

## Deliverables

- `resources/icon.ico` (256×256 multi-size; a simple tangerine rounded square with an ink "C" in Fredoka is fine) wired via `win.icon`, and `productName`/`appId` confirmed.
- `pnpm dist` on this machine; then install `Cadence Setup x.y.z.exe` under a **separate Windows user account** (or a clean VM): first launch creates `%APPDATA%\Cadence\cadence.sqlite` and `logs/`, migrations run, onboarding appears, MIDI works with a plugged-in keyboard, audio plays, Today → Practice → Complete loop works, relaunch resumes state.
- `docs/release.md`: step-by-step release checklist (bump version in both `package.json`s, `pnpm check`, `pnpm e2e`, `pnpm dist`, smoke the installer, tag), the SmartScreen note, Defender exclusions for faster builds, Developer Mode note for first `pnpm dist`, and how to collect logs from `%APPDATA%\Cadence\logs` for bug reports.
- Verify `asarUnpack` shipped `better_sqlite3.node` and `extraResources` shipped `drizzle/` (inspect `dist/win-unpacked/resources`).

## Acceptance

- Installer runs on a clean profile with no dev tooling; app starts, migrates, and completes a level.
- Uninstall removes the app but leaves `%APPDATA%\Cadence` (document this).
- `docs/release.md` committed; task status flipped.

## Out of scope

Code signing, auto-update, Microsoft Store.
