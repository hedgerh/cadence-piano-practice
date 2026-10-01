# 05 — Main wiring + IPC

**Status:** todo

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
