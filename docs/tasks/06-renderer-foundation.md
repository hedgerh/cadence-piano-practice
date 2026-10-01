# 06 — Renderer foundation + component library

**Status:** done

Everything the nine screens share: the shared components with pixel-exact CSS, the keyboard and circle geometry, MIDI and audio adapters, design fixtures, and a dev gallery to review components in isolation.

## Inputs

- `docs/ui.md` §1–2 (tokens, component table with design file/line citations, PianoKeyboard and CircleOfFifths geometry), §4 (MIDI/audio adapters).
- `docs/engine.md` §7 (synth spec), §5 (what the reducers will need from MIDI).
- All nine files in `docs/handoff/design/` — the component CSS must be copied verbatim from the cited lines.
- Existing: `renderer/styles/tokens.css`, `global.css`, `fonts.css`, `lib/api.ts`, `app/router.tsx`.

## Deliverables

- `renderer/components/ui/*` — every component in the ui.md table (`Name.tsx` + `Name.module.css`, props typed; cite design `File:line` in a comment). Include `qualityColor()` in `renderer/lib/quality.ts`.
- `renderer/components/music/PianoKeyboard/` with `keyboardLayout.ts` (pure: `whiteKeys(variant)`, `blackKeys(variant)` returning computed `leftPx`); `CircleOfFifths/` with `circleLayout.ts` (pure trig placement).
- `renderer/midi/` — `MidiInput.ts` (interface + `MidiStatus`, `NoteEvent`), `WebMidiInput.ts`, `KeyboardMidiInput.ts`, `FakeMidiInput.ts`, `midiStore.ts` (Zustand; composes real device → keyboard fallback; exposes `held`, `status`, `events`), `hooks.ts` (`useMidiStatus`, `useHeldNotes`, `useMidiEvents`). `window.__cadenceDev = { midi: { press, release } }` only when `import.meta.env.DEV` or `CADENCE_E2E` (pass via `window.cadence`? no — read `import.meta.env.VITE_CADENCE_E2E` set by main through `process.env` at build, or expose a `dev.isE2E` flag over IPC; pick the simplest that works in the packaged e2e run and document it).
- `renderer/audio/` — `Synth.ts` interface, `WebAudioSynth.ts` (exact envelope from engine.md §7, compressor on master), `NullSynth.ts` (records `(midi, at, dur)` tuples), `player.ts` (`Sound` → synth calls), `useAudio()`.
- `renderer/dev/fixtures/*.ts` — sample data matching each design verbatim (Harry, evening, 8-day streak, 1,240 XP, Roland FP-30X; A major with I/ii done, iii current; Intervals L3 with results `[true,true,false]`, target P4, chosen M3; G major EarChord answered IV; EarKey home E with tries G, A; etc.).
- `renderer/dev/DevScreens.tsx` + routes `/dev/components` (gallery of every component in every variant) and `/dev/screens/:name` (placeholder until screens exist), registered only in dev/e2e.
- `e2e/probes.ts` — helper asserting computed styles (`expectStyle(locator, { height:'76px', borderBottom:'2px solid rgb(239, 232, 223)' ... })`) and `e2e/components.spec.ts` probing the gallery: header 76px; pills 40px; keyboard 661/332 wide, white 44×150/120, black 28×95/76 and the ten black-key `left` values; circle node sizes 72/84/40 and positions within 1px of Path.dc.html's hardcoded values.
- Unit tests: `keyboardLayout` (lefts = `[34.5, 81.5, 175.5, 222.5, 269.5, 363.5, 410.5, 504.5, 551.5, 598.5]`), `circleLayout` (all 24 positions vs Path:94–129 within 0.1px), `player` against `NullSynth` for all four `Sound` types, `midiStore` with `FakeMidiInput` (note-on adds, note-off removes, velocity-0 is off, disconnect clears).

## Acceptance

- `/dev/components` renders every variant with no console errors; fonts load with zero network requests (DevTools Network has no font requests).
- `KeyboardMidiInput`: pressing `a s d` on the computer keyboard lights C4 E4 G4 in the gallery keyboard; MidiPill shows "No keyboard found" (no device) or the device name.
- All probes and unit tests pass; `pnpm check` green; screenshot `e2e/screenshots/06-components.png`.

## Out of scope

Screens and session reducers (Tasks 07–15).

## Notes

**Dev/e2e gating.** `main.tsx` awaits `detectRuntimeMode()` (`lib/runtimeMode.ts`) before rendering. It calls `api['app.ping']()` once, seeds the query cache with the reply (so the Shell doesn't ping again), and reads `env` defensively (`(ping as { env?: … }).env`). Dev tools are on when `import.meta.env.DEV || env.dev || env.e2e`. When on, `createAppRouter({ devRoutes: true })` registers `/dev/components` and `/dev/screens/:name`, a `FakeMidiInput` is attached to the MIDI hub, and `window.__cadenceDev = { mode, midi: { press, release, releaseAll, held, status } }` is installed. A packaged build (env.dev = env.e2e = false) has neither the routes nor the global. Recorded in `docs/decisions.md`.

**What landed.** `components/ui/*` (every ui.md §2 row plus `StreakPill`/`XpPill`/`MidiPill`, a shared `ButtonBase`, `PulseDot` and `icons.tsx`), `components/music/PianoKeyboard` + `keyboardLayout.ts`, `components/music/CircleOfFifths` + `circleLayout.ts`, `lib/quality.ts`, `midi/*` (`MidiInput`, `WebMidiInput`, `KeyboardMidiInput`, `FakeMidiInput`, `midiStore` with `device`/`fallback`/`dev` roles, `hooks.ts`, `appMidi.ts`), `audio/*` (`Synth`, `WebAudioSynth`, `NullSynth`, `player`, `useAudio` + `installAudioUnlock`), `dev/fixtures/*` (one file per design), `dev/DevComponents.tsx` (gallery, every variant wrapped in `data-testid="g-…"`), `dev/DevScreens.tsx` (placeholder + fixture JSON), `e2e/probes.ts`, `e2e/components.spec.ts`, `e2e/screenshots/06-components.png`.

**Deviations from the designs / spec.**

- _Keyboard shortcut in Acceptance._ ui.md §4's mapping (`a w s e d f t g …` = C4…E5) puts `a s d` on C4 D4 E4, not C4 E4 G4. I implemented ui.md's mapping; `a d g` lights C4 E4 G4, and the e2e spec asserts that.
- _Circle labels._ ui.md says two-character upcoming labels are 20px, but Path:110 sets only G♭ at 20px (D♭, A♭, E♭, B♭ stay 24px). `CircleKey.compact` reproduces the design exactly; the fixture sets it on G♭.
- _Buttons as `<button>`._ Designs use `<a>` for CTAs. `ButtonBase` renders a router `Link` when `to` is given, otherwise a `<button>` with `border: 0` and `font-family` reset so it matches the `<a>` metrics. The shared reset is `:where()`-scoped (zero specificity) so each variant's verbatim CSS wins.
- _Card variants._ Each variant takes its default `gap` from the first cited design line (flat 14 from Path:58; EarPath:58 uses 12). Screens can override via `className`.
- _Not in the designs (from ui.md):_ MidiPill states other than connected (dune dot; "Looking for keyboards…" pulses; "MIDI unavailable" for no Web MIDI), StageRow `done` (teal check), RomanChip `skipped`/`hinted` at 64px, OutlineInk disabled at 60, one-octave black-key lighting, and PlayButton `:disabled` (opacity 0.6).
- _ShowMeControl_ stays 36px as designed (Task 16 raises it).
- _Synth timings not fixed by engine.md §7:_ phrase notes ring 0.5 s each; cadence chords 0.6 s (last 1.2 s). The voice is the design's `tone()` envelope verbatim, through master gain → compressor (−12 dB, ratio 4).
- _Gallery screenshot_ shows the live MIDI device name if one is plugged in (the spec accepts `no-device` or `connected`).
