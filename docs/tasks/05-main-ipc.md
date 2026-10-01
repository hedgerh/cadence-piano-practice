# 05 — Main wiring + IPC

**Status:** done

Connect the engine to Electron: open the DB, run migrations, build and validate content, compose services, and expose every channel over typed IPC. Add the dev-only seed channel and an e2e test that exercises the engine through the renderer client.

## Inputs

- `docs/architecture.md` §3 (channel list), §4 (startup sequence), §5.
- Existing: `apps/desktop/src/main/index.ts`, `ipc/register.ts`, `ipc/handlers.ts`, `shared/ipc/contracts.ts` (has `app.ping`), `e2e/launch.ts`, `e2e/smoke.spec.ts`.
- `@cadence/core` `createServices`, `seed`, DTO types; `@cadence/db` `openDatabase`, `runMigrations`, `createRepos`; `@cadence/content` `buildTracks`, `validateTracks`.

## Deliverables

- `shared/ipc/contracts.ts` — zod schemas for every channel in architecture.md §3 (`me.*`, `content.*`, `plan.getToday`, `tracks.*`, `sessions.*`, `dev.seed`). Output schemas mirror the DTO types from core exactly (add a type-level assertion that `z.output<Schema>` is assignable to the core DTO).
- `main/db.ts` — resolve DB path (`userData/cadence.sqlite`), migrations folder (`process.resourcesPath/drizzle` when packaged, `packages/db/drizzle` in dev), open + migrate.
- `main/services.ts` — composition root: repos + content + `SystemClock` → `createServices`.
- `main/ipc/handlers.ts` — map each channel to a service call. `dev.seed` registered only when `process.env.CADENCE_E2E === '1'` or `!app.isPackaged`.
- `main/index.ts` — full startup sequence; content validation throws in dev, logs in prod.
- `e2e/engine.spec.ts` — launch, call `dev.seed({scenario:'day8'})` then `plan.getToday` through `window.cadence.invoke`, assert the three design blocks; start a session for `a-major`, record seven steps (one hinted), finish, assert the `CompleteDto` numbers; relaunch with the same userData and assert the plan persisted.

## Acceptance

- `pnpm e2e` passes both specs; a fresh userData boots with a migrated DB and a first-run plan.
- `pnpm dist` installer starts, creates `%APPDATA%\Cadence\cadence.sqlite`, migrates, and `app.ping` works (check the renderer console in the packaged app).
- Unknown channel invocation rejects; malformed input rejects with a zod error (unit test in `src/main/ipc/register.test.ts` using a fake `ipcMain`).
- `pnpm check` green.

## Out of scope

Any UI beyond the placeholder Shell. Renderer hooks are added per screen in later tasks.

## Notes

- **Contracts** (`shared/ipc/contracts.ts`): zod schemas for all 15 channels. `content.track` reuses `TrackSchema` and the session/complete schemas reuse `StepSchema`, `PassSchema` and `QualitySchema` from `@cadence/content`. Optional fields use `.exactOptional()`, matching `exactOptionalPropertyTypes`. A tuple of type assertions (`_ContractDriftGuards`) requires `z.output<…>` and the core DTO and input types to be mutually assignable, so `pnpm typecheck` fails if they drift (checked by mutating a field). The file only `import type`s from `@cadence/core` (ESLint allows this in `src/shared`), and the renderer bundle has no core or db code. `app.ping` now returns `env: { dev, e2e }`.
- **Dev channels:** `Handlers` makes `devChannels` (`dev.seed`) optional. `registerHandlers` skips a channel that has no handler, so a packaged build registers 14 channels and invoking `dev.seed` rejects with "No handler registered".
- **`registerHandlers(ipc, handlers, { onError })`** now takes `ipcMain` as a parameter (type-only `electron` import), so `register.test.ts` can use a fake. It returns the registered channels, and main logs rejections through electron-log.
- **`buildHandlers(ctx)`** has no Electron dependency: it receives services, clock, version, userData and env from `index.ts`.
- **advance-day:** `dev.seed({scenario:'advance-day'})` advances `SystemClock.offsetMs`. Under `CADENCE_E2E=1` the offset is written to `userData/clock-offset.json` (`main/dev/clockOffset.ts`) and reloaded at startup; otherwise the shift lasts only for the current process.
- **Startup** (`main/index.ts`) follows architecture.md §4. electron-log writes to `userData/logs/main.log`, so it respects `CADENCE_USER_DATA`. A packaged startup failure shows an error box and quits. The DB is closed on `will-quit`.
- **Migrations:** packaged builds read `process.resourcesPath/drizzle`; unpacked runs read `app.getAppPath()/../../packages/db/drizzle`. better-sqlite3 13 ships N-API prebuilds, so the same binary works under Node (vitest) and Electron.
- **e2e:** `launchCadence({ userData })` can relaunch over an existing profile. `engine.spec.ts` checks the day8 plan (3 blocks + CTA), the A major session (6 clean / 1 hinted, level XP 40, 4 keys done, next E major, new total 1,315), a malformed input rejected by main, and that after a relaunch the block ids, statuses, CTA and XP are unchanged.
- **Packaged smoke:** `dist/win-unpacked/Cadence.exe` with a fresh `CADENCE_USER_DATA` created `cadence.sqlite` (1 migration applied, 11 tables) and `logs/main.log` (`dev=false e2e=false; 14 IPC channels`).
