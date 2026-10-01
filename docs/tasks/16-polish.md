# 16 — Polish

**Status:** done

Make it feel finished: real device handling, accessibility, edge states, a fidelity pass over all nine screens, and a README.

## Inputs

- `docs/ui.md` §4 (MidiPill states), §5 (probes); `docs/engine.md` §6; HANDOFF §3 ("All tap targets ≥ 44px").
- Everything built in Tasks 06–15.

## Deliverables

- **MIDI**: device picker in the MidiPill (dropdown listing `access.inputs`; selection saved via `me.update {midiDeviceId, midiDeviceName}` and restored on launch), reconnect handling (hot-plug updates the pill and clears held notes), `KeyboardMidiInput` fallback only when no device.
- **Accessibility**: raise ShowMeControl segments to 44px (document in `docs/decisions.md` as a deliberate deviation from the 36px design), visible focus rings (2px `--ink` offset 2) on every interactive element, `aria-label`s on icon-only buttons, keyboard operability of chips and nodes, `prefers-reduced-motion` respected.
- **Edge states**: Today with no active tracks; all keys complete on a circle track; ear track fully complete; `abandoned` sessions (leaving Practice mid-level keeps the session resumable; a "Resume A major" chip on Today); offline post retry queue for `recordStep` (in-memory, retried on next action).
- **Fidelity pass**: run every probe spec; compare each screen's screenshot against its design by reading values; fix deviations; record any intentional ones in the task files.
- **README.md**: what Cadence is, requirements (Windows 10/11, a USB MIDI keyboard optional), install (`Cadence Setup x.y.z.exe`, SmartScreen "More info → Run anyway"), where data lives (`%APPDATA%\Cadence`), development commands, and a pointer to `docs/`.

## Acceptance

- Fresh install → onboarding → complete C major with a real keyboard in under two minutes (manual check by Harry).
- App fully usable with no MIDI device (mark-as-played path) and with a device unplugged mid-session.
- Every probe passes; every screenshot in `e2e/screenshots/` is current.
- `pnpm check` and `pnpm e2e` green.

## Out of scope

Packaging verification on a clean machine (Task 17), sampled piano, streak freezes, cloud sync.

## Notes

**MIDI.**

- `WebMidiInput` listens to one chosen port (preference by id, then name; otherwise the first connected) and exposes `devices$`. `select()` switches ports. Switching or losing the port releases held notes.
- The hub (`midiStore`) carries `devices`/`preference`, `selectDevice()` and `replaceDevice()`.
- The live `MidiPill` is a button with a "Keyboards" menu: `menuitemradio` items, arrow/Home/End/Escape keys, outside-click close, and an empty-state explanation. A caret appears with more than one port. Long names ellipsize.
- `midi/devicePreference.ts` saves the pick with `me.update {midi}` (never before onboarding) and `main.tsx` restores it on launch. Fixture pills stay static.
- The keyboard fallback is heard only with no device (dev: always).
- `midi/fakeMidiAccess.ts` and `__cadenceDev.midi.fakeDevices/plug/unplug/sendFrom/listening` drive the real `WebMidiInput` in e2e.

**Accessibility.**

- ShowMeControl segments are 44px (decisions.md).
- A global `:focus-visible` ring (2px `--ink`, offset 2); the Onboarding input restates it.
- `prefers-reduced-motion` safety net in `global.css`; components already stop their own motion.
- Every interactive element already had a name and was a real button (circle nodes, chips, answer chips). The e2e sweep now enforces names, ≥ 44px buttons and the ring on seven screens.

**Edge states.**

- Today: no active tracks ("Pick something to learn" opens Add), all active tracks complete (subtitle), and "Left mid-way · Resume A major" from the new `TodayDto.resume` (core `plan.service.ts`, contract `ResumeSchema`; `ResumeDto | null` per the dto.ts convention).
- Circle complete: the existing "Every key done" card.
- Ladder complete: a new "Every level done" card.
- `PostQueue` retries parked `recordStep`/`recordPlayback` posts on the next action and at Finish. Nothing is shown unless Finish still cannot save answers.
- New seed `all-complete`.

**Fidelity pass** (all screenshots read against the designs):

- Fixed: EarPath CTA below the fold (Show me moved under it).
- Fixed: Today CTA wrapping beside the no-keyboard note.
- Fixed: task-header pill wrapping long device names.
- Fixed: Learn's "Major (you know this)" label wrapping (Learn:40's 150px is narrower than the text).
- Live screenshots used to show the host's real keyboard. `seed()` now installs a fake "Roland FP-30X", so the pills match Main:36 and the shots are deterministic.
- Intentional deviations are recorded in Tasks 07, 08, 10 and 11.

**Tests.**

- Core: `plan.service.test.ts` (resume: none / chord / latest incl. ear / cleared on finish / not tomorrow), `seed.test.ts` (`all-complete`).
- Renderer: `midi/devices.test.ts` (selection, name fallback, hot-plug, hub, preference), `components.test.tsx` (picker), `today.test.tsx` (modes, resume), `practice/retry.test.ts` (`PostQueue`).
- e2e: `polish.spec.ts` (picker + relaunch persistence, unplug mid-session + full mark-as-played A major with no keyboard, resume, no tracks, all complete, a11y sweep, keyboard circle node, reduced motion) and `earpath.spec.ts` (fold + 44px).
- New screenshots: `16-midi-picker`, `16-practice-no-midi`, `16-today-resume`, `16-today-no-tracks`, `16-today-all-complete`, `16-path-complete`, `16-earpath-complete`.

**Left for Harry.**

- The manual check: fresh install → onboarding → C major on a real keyboard in under two minutes.
- Picking between two real keyboards and unplugging one mid-chord on hardware.
- Task 17 should confirm the packaged app's userData resolves to `%APPDATA%\Cadence`. `apps/desktop/package.json` has no `productName`; only `electron-builder.yml` sets it.
