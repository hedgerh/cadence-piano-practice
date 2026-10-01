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

## 2026-10-01 — Polish (Task 16)

- **ShowMeControl segments are 44px, not the design's 36px** (Practice:188–190). This is a deliberate deviation for HANDOFF §3 "All tap targets ≥ 44px". Padding, radius, type and the sand well are unchanged, so the well grows from 44 to 52px. On EarPath the control moved **below** "Start Level N" (it sat between the "How a level works" card and the up-next card), so the CTA stays above the fold at 1280×820.
- **MIDI device picker**: `WebMidiInput` listens to **one** input port. It picks the preferred port (matched by id, then by name, because Windows port ids can change between USB sockets), otherwise the first connected one. It lists every connected port in `devices$`. The live MidiPill is a button that opens a menu of those ports. A pick switches the hub at once and is saved with `me.update {midi: {deviceId, deviceName}}`. `main.tsx` restores it at launch from `me.get`. Nothing is written before onboarding, so a pick can never create an unnamed profile. Switching ports, or losing the active one, releases every held note. Fixture pills (`status` prop) stay static `<div>`s.
- **Computer-keyboard fallback** is heard only while no device is connected, which was already true. In dev it is always heard.
- **Resumable sessions**: leaving Practice or an ear drill never abandons the session (the renderer never sends `abandoned`). `TodayDto.resume` (`ResumeDto | null`, following the dto.ts `T | null` convention rather than an optional field) is today's most recent unfinished session with at least one recorded step. Today shows a "Left mid-way · Resume A major" card at the top of the tracks column, linking to `sessionRoute`. The card is hidden when the CTA already continues that level.
- **Offline post queue**: `PostQueue` (`features/practice/retry.ts`) wraps `recordStep`/`recordPlayback`. Each post retries with backoff (250/1000/3000 ms). A post that still fails is parked in memory and re-sent with the next action, then once more by Finish. Only answers block Finish (a calm "Couldn’t save … Try again" line). A lost play-back bonus never does.
- **Deterministic MIDI in e2e**: `window.__cadenceDev.midi.fakeDevices([...])` swaps the device input for a real `WebMidiInput` over a scripted `MIDIAccess` (`midi/fakeMidiAccess.ts`), with `plug`/`unplug`/`sendFrom`. `e2e/ipc.ts` `seed()` installs the design's "Roland FP-30X" after every seed, so screenshots and copy no longer depend on what is plugged into the host. The fake keeps `onstatechange` behind an accessor pair. With a plain field, Rollup folded every read to `null` in the production bundle and dropped the hot-plug dispatch.
- **New seed `all-complete`**: first-run plus every Major diatonic chords key and every Ear training level, passed today. It drives the edge-state e2e.

## 2026-10-01 — Hands-free key loop

- **Why**: the owner knows the major keys and wants to cycle through them with his hands on the piano. Before this, every key needed two clicks at the computer ("Finish the key" on Practice, then "Keep going — E major" on Complete).
- **Setting**: `profile.auto_continue` (integer-mode boolean, **default on**; migration `0001`, existing profiles upgrade to on), exposed as `MeDto.settings.autoContinue` and `me.update {settings: {autoContinue}}`.
- **Practice**: with it on, the finished state ("All seven. Nice.") runs the same finish path as the button after 1.2 s (`AUTO_FINISH_MS`, timer in `usePracticeSession`; the reducer stays pure). The button stays for manual use, with a small "Finishing…" hint. A failed finish shows the usual "Try again" line and waits for the button.
- **Complete**: on a clean pass with a next level, "Next: E major in 3…" counts 3 → 1 (about 3 s) and then runs the exact "Keep going" action (start the next level's session, navigate with `sessionRoute`). "Stay here" cancels the countdown for that screen. **Any MIDI note-on keeps going immediately, whatever the setting** (caption "Play any key to keep going."); note-offs of the last chord never do. Neither happens with skips (the primary is "Play the N you skipped"), at the end of the circle (`next` null), or for ear drills; the ear results screen is unchanged and keeps requiring a click.
- **How to turn it off**: untick "Keep going automatically" under the buttons on the Complete screen (saved at once with `me.update`). The MIDI "play any key" shortcut stays available.
- **Layout**: one 48px row (countdown, "Stay here", the checkbox) plus one caption line under the actions; the card still fits 1280×820. Not in Complete.dc.html.
- **Tests**: the countdown takes an injectable `Schedule` (fake timers in Vitest; the dev screen `/dev/screens/complete?auto=1|0` freezes it at 3 unless `&run=1`). Specs that click "Finish the key" / "Keep going" themselves turn the setting off with `seed(page, 'day8', { autoContinue: false })`.
