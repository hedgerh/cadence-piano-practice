# 16 — Polish

**Status:** todo

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
