# Decisions log

Append-only. One entry per architectural or product decision agents must follow. Date, decision, why, consequences.

## 2026-10-01 — Stack

- **Electron**, not Tauri. Chromium's Web MIDI is mature and controllable via a permission handler; one language end to end; deepest agent coverage. Tauri 2's WebView2 MIDI permission path is unreliable and would push logic into Rust.
- **No HTTP backend, no NestJS** (overrides Harry's stated preference, with his agreement). A single-user offline app has no HTTP surface. Nest inside Electron main would need a second build pipeline (esbuild cannot emit decorator metadata), a loopback port, and two module systems. Module boundaries come from workspace packages + `core/ports.ts` interfaces + zod-validated IPC. Migration path: `music`, `content`, `core` move into a NestJS service unchanged; the IPC contract becomes the REST contract.
- **SQLite (`better-sqlite3`) + Drizzle**, not Postgres. Zero-install single file. Schema kept Postgres-portable: text ids, integer epoch-ms timestamps, `YYYY-MM-DD` local-date strings, enums as text, no SQLite-only SQL.
- **electron-vite 5 + Vite 7 + electron-builder 26 (NSIS).** `@vitejs/plugin-react` pinned to 5.x because 6.x requires Vite 8, which electron-vite does not yet support.
- **TypeScript 5.9**, not 7.x: typescript-eslint supports `< 6.1`.
- **React 19, react-router 7 (`createHashRouter`), TanStack Query 5, Zustand 5** (MIDI/device state only), `useReducer` pure reducers for practice/ear sessions.
- **CSS Modules + `tokens.css`**, not Tailwind: designs are inline px/hex; 1:1 property copy is the lowest-error path to fidelity.
- **Vitest 5 with `test.projects`** (the workspace file is gone in Vitest 5). Playwright `_electron` for e2e.
- **pnpm 12**, installed via `npm i -g pnpm` because corepack cannot write shims into Program Files without admin.

## 2026-10-01 — Content

- Content is **generated at runtime in main from code** (not committed JSON). A snapshot test freezes all step ids so progress rows cannot orphan silently.
- `Lesson` is **structured** (chip rows, pivot, bridge), not markdown; the Learn design cannot be expressed in markdown.
- Minimal extensions to HANDOFF §4 types: `Track.blurb/available/lesson`, `Level.key/blurb/activeOptions`, `Step.id/context/hint/explain/quality`.

## 2026-10-01 — Engine defaults (see docs/engine.md §6 for the full list)

- Skipped steps return once at the end of a level; second skip resolves `skipped` (0 XP, due tomorrow).
- Hinted and mark-as-played steps earn step XP; marked is not clean.
- Complete screen's XP tile shows the **level bonus only** (+40), as designed; step XP is awarded live.
- "Keep going" jumps straight to the next uncompleted key.
- Unlock `{stage, level N}` is satisfied when level N−1 of that stage is passed.
- Ear play-back is optional; +5 XP once per question only when the notes match.
- 5-question levels pass at 4/5.
- Held MIDI keys are lit `sun`; priority `correct > home > hint > held > tried`.

## 2026-10-01 — Engine (Task 04)

- **Unlock copy** is generated from the Unlock and the source stage's state: "Unlocks at <S> L<N>" while S is open (the learner is climbing it), otherwise "Unlocks after <S> L<N−1>". This reproduces all four EarPath.dc.html strings. A length-only rule cannot.
- **One interval step per session**: a step answered more than once in a session (cycled ear pools) advances its review interval at most once. Any miss in the session resets it.
- **Idempotent writes**: `recordStep` retries never reschedule and only correct XP by the difference. `finishSession` returns the stored result on a second call.
- **Streak counting**: any completed chord level or passed ear level counts toward `day_log.blocks_completed`, inside or outside the plan. Failed ear attempts and abandoned sessions do not count.
- **Plan/session linking**: `sessions.start` resumes today's unfinished session for the level and claims today's not-done plan block for that level when no block id is given. A failed or abandoned session returns its block to `pending`.
- **Seeds** drive the real services on past local days (via a FakeClock-backed service set over the same repos), so seeded data always satisfies the ledger, streak and schedule invariants. Seeds require an empty database.

## 2026-10-01 — Renderer foundation (Task 06)

- **Dev/e2e gating** uses the `app.ping` reply: the renderer pings once at startup (`lib/runtimeMode.ts`), seeds the TanStack cache with the reply, and enables `/dev/*` routes and `window.__cadenceDev` when `import.meta.env.DEV || env.dev || env.e2e`. No build-time `VITE_*` flag, so the same `out/` bundle serves both `pnpm e2e` and production.
- **Keyboard lighting is keyed by MIDI number**, not note name (`KeyStates = Record<Midi, KeyState>`, built from spelled notes with `keyStates()`), so enharmonic spellings (C♯4 / D♭4) light the same key.
- **MIDI composition**: one Zustand store over three roles: `device` (Web MIDI; its status is the pill), `fallback` (computer keyboard; heard when no device is connected, always in dev), and `dev` (a `FakeMidiInput` behind `window.__cadenceDev.midi`).
- **Cadence chord length**: the first three chords of a `cadence` Sound ring 0.6 s at 0.65 s spacing and the final I rings 1.2 s (~3.2 s total). engine.md §7 gives only the spacing.

## 2026-10-01 — EarPath (Task 11)

- **Ear track "Show me"**: ear drills (Task 14 Chords in a key) read the **ear track's** `track_settings.visibility`. It is set from EarPath with a compact `ShowMeControl` row under the "How a level works" card (`tracks.setSettings {trackId, visibility}`); the drill header gets no control. Not in EarPath.dc.html; it adds one 36px row to the left column, so at 1280×820 the "Start Level N" button sits partly below the fold.
- **Ladder stage → StageRow**: engine stage `open` → `current` (tangerine node, "Level N of M", level segments), `locked` → `locked` (engine `unlockText`), `complete` → `done` (teal check, "Complete"). Several stages can be open at once; each renders `current`, and only the stage holding `upNext` links its card (to `upNext.route`).
