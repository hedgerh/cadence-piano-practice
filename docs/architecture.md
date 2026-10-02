# Architecture

## 1. Process model

| Concern                                                              | Process                                               | Package                     |
| -------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------- |
| Pitch math, key→chords, matchers, hint derivation, voicing placement | Renderer (zero-latency grading) and main (validation) | `@cadence/music`            |
| Track definitions, generators, validator                             | Both (pure data)                                      | `@cadence/content`          |
| Plan builder, review scheduler, XP, streak, mastery, sessions        | Main                                                  | `@cadence/core`             |
| Drizzle schema, migrations, repositories                             | Main                                                  | `@cadence/db`               |
| Web MIDI, Web Audio, React UI, live session reducers                 | Renderer                                              | `apps/desktop/src/renderer` |

The renderer runs the practice loop locally: it holds the set of currently-down MIDI notes, runs the `music` matchers on every note-on/off, and when a step resolves it sends **one** IPC call. Main persists, reschedules, awards XP and returns updated state. There is no per-keystroke IPC.

## 2. Repository layout

```
apps/desktop/
  electron.vite.config.ts   electron-builder.yml
  src/main/        index.ts window.ts permissions.ts db.ts services.ts ipc/{register,handlers}.ts dev/seed.ts
  src/preload/     index.ts index.d.ts            (two generic functions; never edited for new channels)
  src/shared/ipc/  contracts.ts                    (zod; single source of truth for IPC)
  src/renderer/    main.tsx app/router.tsx lib/{api,queryClient}.ts styles/{tokens,global,fonts}.css
                   components/ui/* components/music/{PianoKeyboard,CircleOfFifths}/
                   features/{today,practice,complete,path,learn,ear}/
                   midi/ audio/ dev/
  e2e/             playwright.config.ts launch.ts *.spec.ts screenshots/
packages/
  music/   content/   core/   db/   (source-exported, no build step)
docs/    handoff/ (read-only reference)  tasks/  architecture.md engine.md ui.md decisions.md
```

### Dependency direction (ESLint-enforced)

`music` → nothing · `content` → `music` · `core` → `music`, `content` · `db` → `core` (implements its ports) · `main` → all · `renderer` → `music`, `content`, `shared/ipc` only. `packages/*` never import `electron`, `react`, or `node:*`.

## 3. Typed IPC

- `shared/ipc/contracts.ts`: `contracts = { 'plan.getToday': { input, output }, ... }` with zod schemas. Keys are channel names.
- Preload exposes `window.cadence = { invoke, on }` only.
- `main/ipc/register.ts` registers one `ipcMain.handle` per contract key and parses input **and** output.
- `renderer/lib/api.ts` is a Proxy-based typed client that re-parses output. TanStack Query key = `[channel, input]`.

### Channels

| Channel                   | Input → Output                                                                                                                                                              | Used by                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `app.ping`                | void → `{ ok, version, userDataPath, env:{dev,e2e} }`                                                                                                                       | smoke test                                                                  |
| `me.get`                  | void → `{ name, timezone, xpTotal, streak:{days,keptToday,atRisk}, midi:{deviceId?,deviceName?}, settings:{showMarkPlayedAlways}, firstRun }`                               | all headers                                                                 |
| `me.update`               | partial of the above → same                                                                                                                                                 | onboarding, MIDI pill                                                       |
| `content.tracks`          | void → `TrackSummary[]` (id, title, map, available)                                                                                                                         | pills, Today                                                                |
| `content.track`           | `{trackId}` → `Track` (full content)                                                                                                                                        | Path, Practice, Ear                                                         |
| `plan.getToday`           | void → `TodayDto` (greeting, blocks[≤3], primary CTA, track cards, estimateMin)                                                                                             | Today                                                                       |
| `tracks.overview`         | `{trackId}` → `TrackOverviewDto` (progress, circle nodes **or** ladder stages with states, upNext, lessonSeen, visibility)                                                  | Path, EarPath                                                               |
| `tracks.setSettings`      | `{trackId, visibility?, active?}` → settings                                                                                                                                | Show-me, Add track                                                          |
| `tracks.lessonSeen`       | `{trackId}` → void                                                                                                                                                          | Learn                                                                       |
| `sessions.start`          | `{levelId, kind:'warmup'\|'learn'\|'review'\|'free', planBlockId?, focus?:'misses'}` → `SessionDto` (sessionId, steps with last results, ear `questions[]`, resumed steps)  | Practice/Ear mount                                                          |
| `sessions.get`            | `{sessionId}` → `SessionDto`                                                                                                                                                | reload resume                                                               |
| `sessions.recordStep`     | `{sessionId, stepId, ordinal, result:'clean'\|'hinted'\|'skipped'\|'marked'\|'wrong', hintLevel, chosen?, tries?, elapsedMs}` → `{xpAwarded, xpTotal, dueOn, intervalDays}` | each resolved chord / answered question; idempotent on (sessionId, ordinal) |
| `sessions.recordPlayback` | `{sessionId, ordinal}` → `{xpAwarded, xpTotal}`                                                                                                                             | ear feedback play-back; idempotent                                          |
| `sessions.finish`         | `{sessionId, durationMs, abandoned?}` → `CompleteDto`                                                                                                                       | Complete / ear results                                                      |
| `dev.seed`                | `{scenario:'first-run'\|'day8'\|'ear-unlocked'\|'advance-day'}` → void                                                                                                      | **registered only when `CADENCE_E2E=1` or dev**                             |

## 4. Startup sequence (main)

1. `app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')` before ready.
2. `await app.whenReady()`; `installPermissionHandlers()` — **both** `setPermissionRequestHandler` and `setPermissionCheckHandler` allowing `midi`/`midiSysex`, denying all else. Without both, `requestMIDIAccess()` rejects with SecurityError.
3. Open DB at `userData/cadence.sqlite` (`PRAGMA journal_mode=WAL; foreign_keys=ON`); run bundled Drizzle migrations. Packaged: folder shipped via electron-builder `extraResources` and resolved from `process.resourcesPath`; dev: `packages/db/drizzle`.
4. Build content from generators; `validateTracks()` throws in dev, logs in prod.
5. `createServices({ repos, content, clock })` composition root (plain object, no DI container); `registerHandlers(buildHandlers(services))`.
6. `BrowserWindow` 1280×820 (`useContentSize`), min 1100×720, `backgroundColor #FAF7F2`, `show:false` → `ready-to-show`; `contextIsolation`, `sandbox`, no `nodeIntegration`; deny `will-navigate` and `window.open`.
7. `electron-log` to `userData/logs`.

Environment: `CADENCE_USER_DATA` overrides the userData path (e2e), `CADENCE_E2E=1` enables dev-only IPC and `window.__cadenceDev`.

CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:` (inline styles needed for computed key/circle positions).

## 5. Data layer

`better-sqlite3` (sync) + Drizzle `sqlite-core`. Migrations generated with `drizzle-kit generate` into `packages/db/drizzle/`, applied at startup with `migrate()`. Never run `drizzle-kit push` against a user DB. Repos implement `core/ports.ts`; tests run real migrations against `:memory:`.

Postgres path: redeclare tables with `pg-core`, swap driver and migrator import. Nothing in `core`, `content`, `music` or the renderer changes.

## 6. Build & packaging

- `electron-vite` with `externalizeDepsPlugin({ exclude: workspace packages })` so source-exported packages are bundled; `better-sqlite3` stays external.
- `electron-builder.yml`: NSIS x64, `asarUnpack **/*.node`, `extraResources` for migrations, unsigned.
- DB and logs in `%APPDATA%\Cadence\`.

## 7. Testing

- Vitest projects: `packages` (node), `main` (node), `renderer` (jsdom). `pnpm check` = typecheck + lint + format + test.
- `core` tests use `FakeClock` + in-memory repos; `db` tests use `:memory:` with real migrations.
- MIDI is behind `MidiInput` (`WebMidiInput`, `KeyboardMidiInput`, `FakeMidiInput`); audio behind `Synth` (`WebAudioSynth`, `NullSynth`).
- Playwright `_electron` (`e2e/launch.ts`) launches the built app with a temp userData and `CADENCE_E2E=1`, seeds via `dev.seed`, drives MIDI via `window.__cadenceDev.midi.press(...)`, screenshots at 1280×820.
- Fidelity probes (`e2e/probes.ts`, Task 06+) assert computed styles against the design values.

## 8. Windows pitfalls

See `CLAUDE.md` → Windows notes, and `docs/tasks/17-packaging.md`.
