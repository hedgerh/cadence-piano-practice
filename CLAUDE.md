# Cadence — agent guide

Cadence is a daily music-theory practice desktop app (Windows, Electron) for a beginner pianist with a MIDI keyboard: "Duolingo for theory, no tempo pressure." The app is an **engine** plus **content**. The engine knows nothing about music: it draws paths, builds today's plan, listens to MIDI, grades answers, runs hints, XP, streaks and review scheduling. Everything the learner practices is a **track**, data produced by `packages/content`.

**Adding or changing anything the learner practices means editing `packages/content` only. Never touch the renderer to add content.**

## Sources of truth

- Behavior and content model: `docs/handoff/HANDOFF.md` §4–5, refined by `docs/engine.md` (resolved ambiguities). Cite sections in tests, e.g. `// HANDOFF §5 review scheduling`.
- Layout, copy, colors, states: `docs/handoff/design/*.dc.html`. These prototypes **do not render standalone** (they load a missing `support.js` and use a template runtime). Read them as style specs; do not try to screenshot them.
- Architecture, data model, UI system: `docs/architecture.md`, `docs/engine.md`, `docs/ui.md`, `docs/decisions.md`.
- Work backlog: `docs/tasks/NN-name.md`. Work tasks in order; each has Inputs, Deliverables, Acceptance, Out of scope.

## Commands

```
pnpm install            # never use npm install / yarn in this repo
pnpm dev                # electron-vite dev: renderer HMR, main/preload restart on change
pnpm check              # typecheck + lint + format:check + test (must be green before finishing a task)
pnpm test               # vitest run (projects: packages, main, renderer)
pnpm test --project packages
pnpm lint:fix / pnpm format
pnpm e2e                # builds, then Playwright _electron smoke/screens with a temp userData
pnpm dist               # NSIS installer into apps/desktop/dist
pnpm dist:mac           # on a Mac only: DMG + zip (ad-hoc signed, not notarized); CI: .github/workflows/build-mac.yml
pnpm db:generate        # drizzle-kit generate after editing packages/db/src/schema.ts
pnpm rebuild:native     # after bumping Electron: rebuild better-sqlite3 for the Electron ABI
```

## Where things live

| Path                                       | What                                                                                    | May import                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------- |
| `packages/music`                           | pure theory: pitch, keys, triads, intervals, voicing placement, match evaluators        | nothing                          |
| `packages/content`                         | zod content model, track generators, validator, lessons                                 | `music`                          |
| `packages/core`                            | engine services (plan, review, XP, streak, sessions) + `ports.ts` repo/Clock interfaces | `music`, `content`               |
| `packages/db`                              | Drizzle schema, migrations (`drizzle/*.sql`), repos implementing `core/ports.ts`        | `core`                           |
| `apps/desktop/src/main`                    | Electron main: startup, permissions, DB bootstrap, composition root, IPC handlers       | everything                       |
| `apps/desktop/src/preload`                 | two generic functions (`invoke`, `on`). **Never edit to add a channel.**                | electron                         |
| `apps/desktop/src/shared/ipc/contracts.ts` | the IPC contract: channel → zod input/output. Single source of truth.                   | zod                              |
| `apps/desktop/src/renderer`                | React UI, MIDI, audio, session reducers                                                 | `music`, `content`, `shared/ipc` |

Rules enforced by ESLint (`eslint.config.js`): `packages/*` never import `electron`, `react`, or `node:*`; the renderer never imports `electron`, `@cadence/db`, or `@cadence/core`. Packages are source-exported (no build step).

## IPC

Every renderer→main call goes through `shared/ipc/contracts.ts`. Adding a procedure = add a contract entry + implement it in `main/ipc/handlers.ts` (+ optionally a hook in the renderer). Main validates input and output with zod; the renderer client `renderer/lib/api.ts` re-validates output. Never call `ipcRenderer` from renderer code; use `api['channel.name'](input)` and TanStack Query with key `[channel, input]`.

## Design fidelity

- Copy inline styles from the design file verbatim into the component's `.module.css`; cite the design file and line in a comment.
- Use only variables from `renderer/styles/tokens.css`. Chord quality colors go through `qualityColor()` (major → tangerine, minor → teal, diminished → lavender). No red anywhere: a miss is lavender.
- Fredoka only for headings and numerals (600/700); Nunito for everything else (600–800). Fonts are bundled; never load from Google.
- Tap targets ≥ 44px. Dark text on bright fills; never white on tangerine or teal.
- Do **not** add a global `box-sizing` reset; the designs mix content-box and border-box per element.
- Geometry is computed, not hardcoded (black-key offsets `47·(i+1) − 12.5`; circle nodes by trig). Tests assert the computed values equal the design's.

## Definition of done (every task)

1. `pnpm check` is green.
2. New behavior has a Vitest test; engine rules cite the HANDOFF section.
3. UI tasks commit a 1280×820 Playwright screenshot under `apps/desktop/e2e/screenshots/` and note deviations from the design in the task file.
4. Update the task file's status line and, if you changed an architectural decision, append to `docs/decisions.md`.
5. Commit with a clear message. Do not push unless asked.

## Windows notes

- pnpm only. `pnpm-workspace.yaml` allowlists build scripts for `electron`, `better-sqlite3`, `esbuild`, `@swc/core`; without that the Electron binary and the SQLite prebuilt never download.
- `.npmrc` uses `node-linker=hoisted` so electron-builder sees a flat tree. Do not add `shamefully-hoist`.
- Electron is pinned exactly. After bumping, run `pnpm rebuild:native`. Escape hatch if native rebuilds fight you: swap `packages/db/src/client.ts` to `node:sqlite` (one file).
- Compute local dates for streaks with `Intl.DateTimeFormat` in the user's timezone; never `toISOString().slice(0, 10)`.
- `createHashRouter` only (file:// in production).
- macOS is supported too (decisions.md 2026-10-12 "macOS build"); build it on a Mac or via the Build macOS workflow, never from Windows (better-sqlite3 is native). Keep `process.platform` checks to `main/`.
- First `pnpm dist` may need Windows Developer Mode (symlink privilege for electron-builder's cache). The installer is unsigned; SmartScreen will warn.
