# 00 — Scaffold

**Status:** done (2026-10-01)

## Deliverables

- pnpm 12 workspace (`pnpm-workspace.yaml`: `nodeLinker: hoisted`, `allowBuilds` for electron / better-sqlite3 / esbuild / @swc/core / electron-winstaller).
- Root tooling: TypeScript 5.9 strict base, ESLint 10 flat config with dependency-direction rules, Prettier, Vitest 5 projects (`packages`, `main`, `renderer`).
- `apps/desktop`: electron-vite 5 + Vite 7, Electron 44.5.1 pinned, electron-builder NSIS config, main (permission handlers, window 1280×820, electron-log, `CADENCE_USER_DATA` override), preload (two generic functions), `shared/ipc/contracts.ts` with `app.ping`, typed renderer client, tokens/global/fonts CSS, placeholder Shell, Playwright `_electron` smoke test.
- Package skeletons `@cadence/{music,content,core,db}` (source-exported, `typecheck` scripts, db has `drizzle.config.ts`).
- Docs: `CLAUDE.md`, `docs/architecture.md`, `docs/engine.md`, `docs/ui.md`, `docs/decisions.md`, this backlog, handoff copied to `docs/handoff/`.

## Acceptance (verified)

- `pnpm install && pnpm check` green.
- `pnpm build` produces `out/{main,preload,renderer}`; fonts bundled as local assets.
- `pnpm e2e`: app boots, `app.ping` answers over IPC, `navigator.requestMIDIAccess()` resolves, Fredoka and Nunito load locally; screenshot `e2e/screenshots/00-scaffold.png`.
- `pnpm dist` produces an NSIS installer in `apps/desktop/dist/`.

## Notes / deviations

- pnpm 12 ignores `.npmrc` `node-linker`; the setting lives in `pnpm-workspace.yaml` as `nodeLinker`. `onlyBuiltDependencies` is now `allowBuilds`.
- Electron 44 embeds Node 24.21 (same ABI as the system Node), so `better-sqlite3`'s stock prebuilt loads without a rebuild. Keep `pnpm rebuild:native` for future Electron bumps.
- corepack could not write shims into Program Files; pnpm was installed with `npm i -g pnpm`.
