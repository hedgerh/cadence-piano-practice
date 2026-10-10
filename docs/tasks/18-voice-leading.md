# 18 — Voice leading tracks

**Status:** done on branch `voice-leading` (2026-10-10), pending the owner's review before it is merged

Phase 1 of `docs/roadmap.md`: get fluid with inversions and moving between chords, the hand skills improvising needs.

## Inputs

- `docs/roadmap.md`; HANDOFF §4 (Match union: "inversions & voice leading (voicing)"), §5 (MIDI matching, no tempo).
- The unavailable `inversions-voice-leading` stub (9 exact-octave `voicing` steps per key) it replaces.

## Deliverables

- **Engine** (`@cadence/music`):
  - `voiceLeading.ts`: voice motion paired low to high; the nearest voicing; whole voice-led paths kept on the keyboard.
  - `chord.bass`: a named inversion in any octave.
  - The `progression` match: chords in order, each voice ≤ `maxMove` from the voicing actually played. Letting go keeps your place, and `freeBass` adds a left-hand bass.
  - `hintFor(spec, state)`.
- **Content** (the "Voice leading" group, 12 major keys each):
  - **Inversion shapes**, with a lesson: climb I/IV/V/vi through root, 1st, 2nd and root again, then all 8 inversions by name.
  - **Smooth progressions**, with a lesson: I–IV–I, I–V–I, I–IV–V–I from each inversion of I, I–V–vi–IV, I–vi–IV–V and ii–V–I, right hand, ≤ 2 semitones per voice.
  - **Bass & chords**: the six non-inversion progressions with a left-hand root.
  - Model additions: `Step.parts`, `Lesson.voicings` and the `progression` step noun. The validator proves every progression is playable as shown.
- **Renderer**:
  - Progression practice: chord chips, the previous chord outlined, too-far voices in lavender with a nudge, "Hear it", and the hint following what you played.
  - A three-octave keyboard (C2–B4) on levels with progressions.
  - Lesson chord-shape tiles over one shared keyboard.
- **Copy**: "N of M progressions", "All eight progressions, every move smooth." Mixed levels read "steps".

## Acceptance

- `pnpm check` green, with Vitest for:
  - motion, nearest voicing and paths;
  - progression advance, too-far, release and `freeBass`;
  - the bass rule;
  - the validator rules;
  - generators (every progression smooth and on the keyboard);
  - practice selectors and lesson tiles.
- `e2e/voice-leading.spec.ts` plays C: I–IV–I smoothly, sees a jump flagged, and saves 1280×820 screenshots `21-voice-leading-practice.png`, `21-voice-leading-too-far.png` and `21-inversions-lesson.png`.

## Deviations from the plan

- **Recall steps:** there are 8, not 6, so every inversion of I/IV/V/vi is asked once per key (12 steps per shapes level).
- **Keyboard:** a full climb (root → 1st → 2nd → root) spans more than the two-octave keyboard in most keys, so every level with progressions uses the three-octave keyboard. One-hand paths are moved down only as far as needed.
- **"Hear it":** plays `progressionPath(match)` directly, so there is no new `chords` Sound type.
- **`progression`:** has no `voices` field. The voice count is the chord's notes, plus one with `freeBass`.
- **Lesson shapes:** shown as tiles over one shared keyboard, not one keyboard per shape, which would not fit 820px.
- **Not in the designs:** all of the above.

## Out of scope

- Minor keys and 7th chords (roadmap phase 2).
- Jam, tempo and recording (phases 3 and 5).
- Melody drills (phase 4).
