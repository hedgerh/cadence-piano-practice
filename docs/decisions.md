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

## 2026-10-02 — Adaptive ear selection and focus rounds

- **Why**: the owner (Intervals L3) missed one or two intervals per lesson and did not feel he was nailing them, while the old rule cycled the 7-step pool to 10 questions, so every interval, including an easy P1, came up once or twice.
- **Adaptive selection** (engine.md §4 Question selection, `core/questions.ts`): due + unseen once each, then weak steps weighted by `times_wrong` (≥ 2 each when ≤ 3 weak; capped at max(2, ⌊0.4 · pass.of⌋) so one interval never takes the whole round and the no-back-to-back rule stays satisfiable), then other steps, and settled steps (interval ≥ 7 days, last clean) at most once, only when slots remain. Small pools fill by round-robin over non-settled steps. Ordering keeps the two shuffle rules; when weighting makes them impossible, the best of 200 seeded shuffles wins. A due step that is also weak (missed yesterday, due today) still gets its weak extras, otherwise yesterday's miss would come back only once.
- **Focus rounds** ("Drill what you missed"): `sessions.start` takes optional `focus: 'misses'`; `sessions.focus` (nullable text, migration `0002`) marks the row. The pool is the level's wrong/hinted steps plus same-root interval neighbours 1–2 semitones away among `activeOptions`; when no active interval is that close (P8 on L3), the nearest active one, so the round is never one interval ten times. A focus round records step progress and step/play-back XP and logs the day (`blocks 0`, so it does not by itself keep the streak), but never passes, completes, scores the level, earns level XP or touches a plan block. It resumes only into another focus start; normal starts ignore it.
- **Results UI**: the ear results screen (pass or fail) shows a third button, SecondaryButton "Drill what you missed", when any answer was wrong or hinted; the actions row may wrap. Focus results: "Focus round", "n of 10 right. Every answer still counts toward review.", a sun note badge on a sand halo (not judged, not in the design), no confetti, no +40 tile (the third tile shows "+N XP for your answers"), buttons "Drill again" / "Back to Level 3" (a normal session). The drill eyebrow reads "Focus · the ones you missed". Dev screen `/dev/screens/ear-results?result=focus`.
- **Anchor tunes** (content only, `earTrack.ts`): every interval step's `explain` appends a reference tune after the EarInterval sentence ("C up to F. 'Here Comes the Bride' — the first two notes."); descending steps use descending references where a standard one exists, else "Hear it, then sing it back before you answer." The M2 anchor is "the step up to 'birth'" in 'Happy Birthday', since its first two notes are the same pitch. Step keys are unchanged.

## 2026-10-02 — Ear level replay

- **Why**: owner feedback: "There isn't a way to remain at a specific level of the ear training. I can't go back to levels 1–3 if I'm on level 4." The ladder map only offered "Start Level N" for the current level, and a pass only offered "Keep going — Level N+1".
- **Engine**: no new rule. A replay is `sessions.start {levelId, kind: 'review'}` on a passed level. Like every session it records step progress (reschedules), step/play-back XP and, on a pass, the +40 level bonus; `level_progress.status` stays `completed` (attempts and scores update, `firstCompletedAt` does not), the ladder's current level and unlocks do not move, and only a plan block for that same level is claimed. Core tests: "ear level replay (review kind)".
- **DTO**: `LadderLevelDto` gains `blurb` (the content level blurb, `''` when none) so the renderer can label levels without knowing content; mirrored in `contracts.ts` (drift guard).
- **EarPath**: in an open stage card, each passed level's segment is a `<button>` (`aria-label` "Replay Level 2"). The visible bar stays 10px; 17px padding with a matching negative margin gives a 44px hit area without moving the design's layout. Open and complete stages with at least one passed level get a TextButton "Replay a level" under the card, toggling a flat card (Path:58) of outlined pills ("Level 1 · Unison, perfect 5th and octave, going up from C"), modelled on the circle track's "Review a finished key". Complete stages keep the design's segment-free card; their replay is the list. Pills stack because level blurbs are sentences. Not in EarPath.dc.html.
- **StageRow**: becomes a two-column grid (rail spans both rows) so the footer sits under the card while the card stays the row's second child. The up-next card is no longer an `<a>` wrapping the card; it renders a cover link (absolute, inset 0) so the replay buttons are not nested inside a link. The whole card is still the tap target.
- **Results**: a passed normal session adds TextButton "Practice Level 3 again" beside "Keep going — Level 4" (same `startLevel` helper as "Try Level 3 again", kind `review`, reusing an open same-level plan block). With nothing next (`next` null: stage finished and the next stage locked, or the ladder done) the primary becomes "Practice Level 3 again" and the secondary "Back to the map" (`/tracks/:trackId`), replacing "Done for today" / "Play it again". Dev screen `/dev/screens/ear-results?result=last`.

## 2026-10-03 — Circle run

- **Why**: owner feedback: "I need to be able to start tracks from the beginning. I want to do all 12 major keys but I left off at A♭ and it won't let me start the track over." The Path CTA always starts the next uncompleted key, and Complete's `next` (and the hands-free countdown) always jumps to the next uncompleted key clockwise, so C → G → … → F in order was impossible once keys were done.
- **Engine**: `sessions.run` (nullable text, `'circle'`, migration `0003`). `sessions.start` takes optional `run: 'circle'` (circle-of-fifths tracks only; ignored on ladders and focus rounds). For a run the engine chooses the kind: `review` when the level is completed, else `learn`, and still claims a matching open plan block. In `finishSession`, a run session's `CompleteDto.next` is the next key in circle order **regardless of completion**, or `null` after the last key (F major / D minor; no wrap), with `next.run = 'circle'`. `CompleteDto` gains `run` and `runPosition` (1-based circle position); `SessionDto` gains `run`. Progress, XP, review scheduling, plan blocks and the day log are unchanged. Resuming an open session for the level today adopts the requested run (or clears it for a one-off start), so a stale run never hijacks a later one-off review.
- **Path**: SecondaryButton "Play the whole circle" beside "Review a finished key" (shown once any key is done, including on a completed track) → `sessions.start {levelId: <first key>, run: 'circle'}` → Practice. The review pills stay one-off reviews. The actions row wraps to fit three buttons.
- **Complete**: eyebrow "Circle run · 4 of 12" (teal-deep, Path eyebrow type). "Keep going — G major", the countdown and play-any-key pass `run: 'circle'` on, so the run continues; skips still never auto-continue. A replay of skipped chords inside a run stays in the run. At the end: the subtitle's second sentence becomes "That's the whole circle." and the actions are "Back to the map" (`/tracks/:trackId`) / "Done for today". Dev screen `/dev/screens/complete?run=mid|end`.
- **Practice**: the TaskHeader eyebrow reads "Circle run · G major" (tone still by kind).
- **Tests**: core "circle run" (order C → … → B → G♭ → … → F → null, kinds, completion ignored, minor end, resume); renderer Complete/Path variants; e2e `circle-run.spec.ts` (day8: C → G by countdown where a one-off goes to A major).

## 2026-10-03 — Minor scales track

- **Why**: the owner asked to learn the minor scales, "similar vibe to the major chords". The `minor-scales` track existed as content (`available:false`) but the Practice screen only ever fed the held set to the matcher, so a `sequence` step could never match.
- **Content**: `minor-scales` is `available: true`. Steps `up` / `down` keep their ids (step keys unchanged) and gain `anyOctave: true` with their `direction`: any octave, one note at a time, as long as the run keeps going that way (the same leniency as chords, which match in any octave). Level blurbs use " · " between accidentals like the chord tracks.
- **Matcher** (`music/match.ts`): `MatchState.played` holds the MIDI notes accepted so far; with `anyOctave` + `direction`, a note that does not move in the run's direction counts as wrong (silent reset). Octave-strict sequences and ear play-backs (no `direction`) are unchanged.
- **Practice**: a new `NOTE_ON` action, dispatched from `useMidiEvents` for every note-on, drives `sequence` steps (a quick tap can come and go between held-set renders, so note-ons are not derived from the held set). Chord steps ignore it. No re-arming is needed between sequence steps: a held key never re-fires a note-on. Accepted notes stay lit teal while the run is in progress; the match flashes the whole run.
- **Copy**: `stepNoun(steps)` in `@cadence/content` (`chord` for chord/voicing levels, `scale` for sequence levels, else `step`) picks the wording: "0 of 2 scales", "Scale 1 of 2", "Up and down. Nice." / "The A minor scale is in your hands now.", Today block "A minor · scale, up and down", Complete subtitle "Up and down, every note in order.", "scales without a hint", resume "1 of 2 scales played". `ResumeDto` and `CompleteDto` gain `stepNoun` (mirrored in `contracts.ts`). Scale levels hide Show me and the chord strip (both are chord concepts) and always show the step name; the keyboard caption reads "One note at a time, any octave. …". Not in the designs.
- **Tests**: matcher, content, core (plan title, resume, Complete), practice reducer and view unit tests; e2e `minor-scales.spec.ts` plays A minor up, then down an octave higher, and finishes (screenshots `18-minor-scales-practice.png`, `18-minor-scales-complete.png`).

## 2026-10-07 — Piano voice

- **Why**: the owner found the synth tone poor for interval identification. The design's `tone()` is a triangle wave (almost a pure tone: few overtones, thin on laptop speakers below middle C) that starts fading as soon as it is struck, so the first note of an interval is gone before the second.
- **What**: `WebAudioSynth` plays recorded piano samples: Salamander Grand Piano V3 (Alexander Holm, CC BY 3.0), the Tone.js MP3 encoding, 17 files one minor third apart from C2 to C6 (1.3 MB) in `renderer/audio/piano/` with a README crediting the source; credit also in the root README. A note uses the nearest sample (ties go to the lower one), pitched by `playbackRate` (at most ±1.5 semitones). It plays at gain 0.9 for the scheduled `dur`, then the damper fades it to 0.0001 over 0.4 s (stop 0.05 s later). So a 0.7 s interval note still rings when the next starts 0.8 s later. Timings in `player.ts` are unchanged, and the master gain → compressor chain is unchanged.
- **Loading**: each MP3 is a lazily loaded JS chunk holding a base64 data URL (`import.meta.glob(..., { query: '?inline' })`), decoded with `atob` → `decodeAudioData`. The packaged app runs from `file://`, where `fetch()` fails, and the CSP (`default-src 'self'`) blocks fetching `data:` URLs. Loading starts when the AudioContext is first created. `unlock()` (called on the first gesture and inside every `play`) waits for it, so the first sound is already piano. Until then, or if every file fails to decode, the triangle `tone()` plays.
- **Tests**: unit tests cover the sample bank (17 files C2..C6), the nearest-sample lookup, the decoder, the piano envelope and the fallback. The e2e smoke test checks `__cadenceDev.audio.voice()` is `'piano'` in the built app.

## 2026-10-08 — Major scales track and track library

- **Why**: the owner asked for a major scales track and "a more scalable way to display tracks", with tracks staying easy to add. Six tracks no longer fit the Path pill row at 1280px, and Today gave every circle track a full card, joined or not. The owner chose the library + groups layout over a sidebar or a dropdown.
- **Major scales** (content only): `majorScales()` = `scaleLevel` over `CIRCLE_MAJOR` (`c-major-scale` … `f-major-scale`), the same up/down any-octave `sequence` steps as the minor scales (`minorScaleLevel` renamed `scaleLevel`). No engine or renderer change was needed. The step-key snapshot only gained keys.
- **Groups**: `Track.group` (required) names the library section: Chords (major, minor, inversions), Scales (major, minor), Ear training. `buildTracks()` keeps a group's tracks adjacent, and sections follow first appearance (`groupTracks` in `@cadence/content`). `TrackSummaryDto` gains `group`, and `TrackCardDto` gains `group` and `blurb` (mirrored in `contracts.ts`).
- **Library** (`/tracks`, `features/library`): it replaces the redirect to the first track. Intro "Tracks", then one section per group with a three-across grid of Main:119-style track cards: title + status, blurb, progress bar, progress / next line, "In your daily plan" in lavender for joined tracks. Unavailable tracks are muted, unlinked "Coming soon" cards. Data comes from `plan.getToday().tracks` (one card per content track), so no new IPC channel was needed. Dev screen `/dev/screens/library` is built from `buildTracks()`. Not in the designs.
- **Track map**: `trackPills` (shared by the circle and ladder maps) keeps only the active track's group. `TrackPills` takes `allTracksTo` and leads with a muted "All tracks" back link (TaskHeader's back style, 44px tall). An unknown `/tracks/:id` goes to the library.
- **Today**: "Your tracks" lists joined tracks only (`isJoined`: available ∧ enrolled ∧ active). The header link reads "All tracks". "Add something to learn" and the no-tracks CTA "Pick something to learn" link to the library. The AddTrackDialog is removed. Starting a track from its map already enrolls it.
- **Adding a track** is still: write a generator in `packages/content`, give it a `group`, and add it to `buildTracks()`. Tests that picked tracks by position (validator fixtures) now look them up by id.

## 2026-10-10 — Relative key on scale practice

- **Why**: the owner asked to see the relative minor/major of the scale being played.
- **Content**: `Level.note` (optional; `**x**` marks bold) is a tip the Practice screen shows while the level is played. Scale levels set it with `relativeKeyNote(key)`: "Relative major: **C major**. Same seven notes, starting on C." / "Relative minor: **A minor**. …". The relative key is the scale's own 3rd (minor) or 6th (major) degree, so spellings follow the key (E♭ minor ↔ G♭ major).
- **Engine/UI**: `SessionDto.levelNote` (mirrored in `contracts.ts`) carries it. `PracticeView` renders any non-null note under the step name as a sand pill, with the key name in bold ink (`renderBold`). Levels without a note (every chord level) render nothing. Not in Practice.dc.html. Any future track can use the field with no renderer change.

## 2026-10-11 — Sound setting

- **Why**: the owner felt something was "a little sus" with the piano samples and wanted to A/B/C three voices: the original tone, a synthesized piano, and the samples.
- **Setting**: `profile.voice` ('tone' | 'synth' | 'samples', default 'samples'; migration `0004` keeps existing profiles on the samples), exposed as `MeDto.settings.voice` and set with `me.update { settings: { voice } }` (mirrored in `contracts.ts`). The renderer applies it with `installVoicePreference` (it follows the cached `me.get` query) and `Synth.setVoice`. Samples still decode in the background whatever the setting, so switching to them is instant.
- **Voices**: `tone` = the design's triangle `tone()`; `samples` = decisions.md 2026-10-07 (the tone while samples are missing); `synth` = `audio/pianoSynth.ts`, additive synthesis with no assets: 10 sine partials stretched by string stiffness (B = 0.0004), weighted by a hammer strike at 1/7 of the string, a quick drop to 45% then a long ring (~3.2 s at C3, halving every two octaves, faster for higher partials), the lowest three partials doubled on a string detuned 1.2 cents, a 30 ms band-passed noise hammer, and the same damper idea after `dur` (0.25 s). Peak 0.32 per note before the compressor.
- **UI**: a "Sound" segmented control (Tone · Synth piano · Recorded piano, the Show me control's look) at the right end of the ear drills' progress bar (ChoiceDrill and KeyDrill, live drills only), so the same question can be replayed in each voice. It hangs 32px below the bar (top-aligned, negative bottom margin) so the bar keeps its height and find-the-key still fits 820px. The switch applies at once and is saved. Not in the designs.
- **Sample measurements** (decoded in the browser, 2026-10-11): onsets 8–16 ms after the file start (a negligible spread); tuning +0…+12 cents, drifting sharp up the keyboard like a stretch-tuned piano (C4 +4, D♯4 +8, D♯5 +12.5; at most ~5 cents between neighbouring samples). Loudness is uneven: RMS over the first 0.5 s runs −17 dB (F♯2) to −35 dB (D♯5). D♯5 is ~9 dB below C5/F♯5, so D5–E5 play much quieter, and A4 (−27.6) is ~4 dB below F♯4, so G♯4–B4 dip. Not corrected yet; per-sample loudness normalisation is the likely fix if the owner hears it.

## 2026-10-12 — Sample loudness and stereo balance (baked)

- **Why**: the owner asked to even out the samples' loudness, baked in rather than analysed at runtime.
- **Correction to 2026-10-11**: that entry measured the left channel only. Measured per channel, the problem is mostly the **stereo image**: the spaced-microphone samples jump left/right from note to note (C3 +6 dB left, D♯3 −4 dB, A4 −7.7 dB, D♯5 −13.5 dB: D5–E5 come almost only from the right). Summed-level differences are smaller (~4.5 dB across G3–G5). A mono mix was rejected because these recordings partly cancel when summed (C5 −8 dB, A3 −5 dB: comb filtering).
- **What**: `audio/pianoGains.ts` holds a baked `[left, right]` gain per sample file, measured once with `measureSampleGains` (each channel's RMS over 0.5 s from the onset, brought to the median channel level ≈ −22.3 dBFS; boost capped at 2.5× (+8 dB) so quiet far-microphone channels don't raise MP3 noise; peaks kept < 0.98). The piano voice routes each sample through splitter → per-channel gain → merger → the existing envelope. No audio analysis at runtime; the MP3 files are untouched (re-encoding would cost a lossy generation).
- **Result** (rendered offline through the real graph, G3–G5): left/right balance 0 dB on every note except D5–E5 (−4.8 dB, was −13.5, limited by the cap); loudness spread 4.5 → 2.3 dB (all within ±0.3 dB except D5–E5, ~1.5 dB softer).
- **Re-measuring**: `__cadenceDev.audio.measureSamples()` (dev/e2e builds) returns the table to paste if the sample files change; a unit test requires one entry per bundled file.

## 2026-10-10 — Voice leading

- **Why**: the owner's new goal is to improvise (string chords together, make up melodies). Fluid inversions and voice leading come first (`docs/roadmap.md` phase 1). The stub track, 9 exact-octave `voicing` steps per key, drilled shapes but never the _move_ between chords.
- **Matching** (`@cadence/music`):
  - `chord.bass` names an inversion in any octave.
  - The new `progression` match grades chords held in order. Each voice may move at most `maxMove` semitones (2 = a whole step), measured from **the voicing the learner actually played**, not a prescribed answer, so any smooth path counts. Voices pair low to high (`voiceMotion`).
  - Lifting keys between chords never resets. Mid-change shapes made of the previous and next chords' notes are `partial`, not misses. The right chord with a too-big jump is `wrong` with `tooFar` (shown in lavender, never red).
  - `freeBass` adds a left-hand bass: the lowest note is the chord's `bass` and may jump, and only the notes above it are measured.
- **Voice-leading math** (`voiceLeading.ts`): `smoothestVoicing` = the close-position voicing with the least total motion, then the most common tones, then the smallest single move. `voiceLead` builds the path used for hints and "Hear it":
  - the first chord is placed like a hint;
  - two-hand paths keep the right hand in C3..B4 over a bass in C2..B2;
  - one-hand paths shift down by octaves only as far as needed to stay on C2..B4.
- **Tracks**: a "Voice leading" library group with Inversion shapes, Smooth progressions and Bass & chords, 12 major keys each (contents in engine.md §2.2). The validator proves every progression can be played as shown within `maxMove` on the C2..B4 keyboard, and forbids a chord repeating the one before it (the held chord would count twice).
- **Content model**:
  - `Step.parts` (one chip per chord).
  - `Lesson.voicings` (chord shapes on the keyboard; `rows` may be empty).
  - `stepNoun` "progression" (mirrored in `contracts.ts`). Mixed levels say "steps".
  - Completion copy: "All eight progressions, every move smooth."
- **UI** (beyond the designs):
  - Progression steps show their chips in place of the big numeral, outline the previous chord (`previous` key state), and light too-far voices `far`, with a lavender nudge.
  - "Hear it" plays the path (not a hint: it lights no keys). Hint 2 lights the next chord nearest to what was played.
  - Levels with progressions use a three-octave keyboard (C2–B4, 990px, the two-octave key sizes).
  - Lessons show chord shapes as tiles over one shared keyboard: picking a tile plays it, and "Hear" lights each shape as it sounds.
- **Not yet**: minor keys and 7th chords (phase 2), and Jam / tempo (phase 3).

## 2026-10-11 — Key progress and chord symbols

- **Why**: the owner found 12 keys daunting with no sense, inside a key, of how far through the track they were. That applies to a circle run and to a one-off learn session alike. They also wanted the inversions named as chords ("E/B").
- **Engine**: `SessionDto.keyProgress` = `{ position, total, done[] }` on circle-of-fifths tracks (null on ladders): the level's 1-based place in circle order, the level count, and which levels are completed. Mirrored in `contracts.ts`.
- **Practice** (beyond the designs):
  - **Eyebrow:** in a circle run it reads "Circle run · key 6 of 12", matching Complete's "Circle run · 4 of 12" (the header title already names the key).
  - **Dot strip:** the progress bar row shows one 10px dot per key, with this key tangerine.
    - In a run, keys before this one are teal (a run goes in circle order) and the label counts the rest of the run: "6 keys left" / "1 key left" / "Last key".
    - Otherwise completed keys are teal and the label counts keys not yet completed: "9 keys left" / "All keys done".
- **Chord symbols** (content): `Step.parts[].sub` is the chord symbol under each chip's numeral, with the bass after a slash for an inversion (`chordSymbol`): B♭ · B♭/D · B♭/F · B♭ on a climb, and C/E · F · G · C for I–IV–V–I from I⁶. Shape recall steps are named "C/E · C major, 1st inversion, E in the bass".
- **Complete chips**: `stepShort` names an inversion as a slash chord ("F/A"), a climb as its chord ("F") and a progression by its chord symbols ("F – B♭ – F"), instead of falling back to the step's full name. A level with more than seven chips, or any numeral longer than four characters ("I climb", "I – IV – I"), wraps the chip row and sizes chips to their text. The seven-chord levels keep the design's single row.

## 2026-10-11 — Descending intervals and free interval practice

- **Why**: the owner was hearing descending intervals while still guessing ascending ones, and asked for a free mode where they choose which intervals are active.
- **Descending stage** (content):
  - Going down was one level of all thirteen intervals right after the ascending ones. It is now its own stage, "Intervals going down", unlocked when the ascending stage is complete (`{intervals, 6}`).
  - Its five levels mirror the ascending ones: P1/P5/P8 from C5; adding 3rds; adding 4th and 2nd; adding m2/m6/M6; then all thirteen from C5/B4/A4/G4.
  - The last level keeps the old `intervals-6` id, so its progress carries over; the step-key snapshot only gained keys.
  - The ascending stage's blurb drops "then descending". The design fixtures (EarPath.dc.html, five stages) are unchanged.
- **Free practice** (`/ear-practice/intervals`, renderer only, not in the designs):
  - **Settings strip:** a toggle per interval, each showing this visit's right/total, root toggles, and direction toggles Up / Down / Together (together = both notes at once, a `chord` sound; at least one direction stays on). A running score and the Sound control sit beside them.
  - **Drill:** the EarInterval drill pieces (112px play button, answer chips for the picked intervals only, FeedbackPanel with the ladder's feedback sentence).
  - **Questions:** drawn evenly from the picked (interval, direction) pairs, never the same pair twice in a row. Each question auto-plays.
  - **Roots:** every interval starts from C by default (the owner asked not to have random starting notes). A Roots row (all twelve pitch classes; the last one on stays on) adds more. Up and together start from the root in C4–B4, down from the root in C5–B5. Saves from before roots existed start from C.
  - **Nothing is recorded:** no session, XP or review (the owner's choice: "fully free"). The settings persist in `localStorage` as a per-device convenience.
  - **Entry:** stages with content `Stage.freePractice: 'intervals'` (both interval stages) get a "Free practice" link in their row footer. From "Intervals going down" the drill starts on Down.

## 2026-10-12 — macOS build

- **Why**: the owner's coworker wants to run Cadence on a Mac. There is no Apple Developer account, so the build does what is possible without one.
- **Packaging** (`electron-builder.yml` `mac`):
  - A DMG and a zip per architecture: arm64 for Apple Silicon, x64 for Intel. The architecture comes from the build machine or `--arm64` / `--x64`.
  - Ad-hoc signed (`identity: '-'`; Apple Silicon will not run unsigned code), no hardened runtime, not notarized.
  - Gatekeeper therefore blocks the first launch. README "Installing" gives the Open Anyway / right-click Open steps and the `xattr` fallback.
  - Icon: `resources/icon-mac.png`, a 1024px render from `scripts/generate-icon.mjs` on Apple's icon grid (824px tile, 100px margin). The ICO is byte-identical.
- **Where it builds**: better-sqlite3 is native, so a Mac build cannot be made from Windows.
  - `pnpm dist:mac` works on a Mac.
  - `.github/workflows/build-mac.yml` (manual run, or a `v*` tag) builds arm64 on `macos-15` and x64 on `macos-15-intel`. It uploads the DMGs and zips as artifacts, and attaches them to the release for a tag.
- **App behaviour**: closing the window keeps the app running on macOS; the Dock icon reopens it (the existing `activate` handler). Electron's default app menu provides Cmd+Q, Edit (copy/paste) and Window. Unpackaged runs skip the `.ico` window icon on macOS. Nothing else is platform-specific: Web MIDI (CoreMIDI), Web Audio, the bundled fonts and samples, and `userData` (`~/Library/Application Support/Cadence`) work as on Windows.
- **Not verified**: no Mac was available. The first workflow run and the coworker's install are the test.
