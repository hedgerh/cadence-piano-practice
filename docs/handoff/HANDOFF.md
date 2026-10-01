# Cadence — build handoff

Cadence is a daily music-theory practice app for a beginner pianist with a MIDI keyboard. Think Duolingo for theory, with no tempo pressure. This folder holds the design (nine screens as self-contained HTML files) and this spec. The design files in `design/` are the source of truth for layout, copy, colors and states; this document is the source of truth for behavior and the content model.

## 1. The two halves

The app is an **engine** plus **content**. The engine knows nothing about music: it draws paths, builds today's plan, listens to MIDI, grades answers, runs hints, XP, streaks and review scheduling. Everything the learner practices is a **track**, a data file the engine reads. Adding something new to learn means adding a track file, never touching the UI.

## 2. Screens (in `design/`)

Each `*.dc.html` is a complete page: inline styles, Google Fonts link, and a small script block that computes per-item styles and (on the interactive ones) state. Read them as design reference, not as production code.

| File | Screen | Notes |
|---|---|---|
| `Main.dc.html` | Today | Greeting, three practice blocks (warm-up / learn / review), track list with progress. Primary action continues the current block. |
| `Path.dc.html` | Track path, circle of fifths | For key-based tracks. Outer ring: 12 keys clockwise from C; inner ring: relative minors. States: done / current / upcoming. |
| `Learn.dc.html` | Lesson | A one-minute explainer shown before a track's first level (here: the minor pattern derived from the major one). |
| `Practice.dc.html` | Practice a key | The core loop. Roman numeral, chord name, two-octave keyboard, MIDI listening, "Show me" visibility control, two-step hint ladder, mark-as-played fallback, skip. Interactive. |
| `Complete.dc.html` | Key complete | Seven chords, time, hint-free count, XP, next key. The chord that needed a hint is flagged for review. |
| `EarPath.dc.html` | Track path, ladder | For non-key tracks: ordered stages, each with levels; stages unlock partway through the previous one. |
| `EarInterval.dc.html` | Intervals drill | Play button (Web Audio in the prototype), 13 interval buttons with only the current level's set active, feedback state with both notes lit on a one-octave keyboard, play-it-back prompt. Interactive. |
| `EarChord.dc.html` | Chords in a key, by ear | "Hear the key" cadence button plus "hear the chord"; answer with the same I–vii° chips used in practice. Shown in its answered state. |
| `EarKey.dc.html` | Find the key | Hear a phrase, hunt for the home note on the real keyboard (tries show faintly, home stays lit), then choose major/minor. MIDI is the answer here, not a bonus. |

Prototype links between screens (`<a href="X.dc.html">`) show the intended navigation.

## 3. Design tokens

Fonts: **Fredoka** (600/700) for headings, big numerals and numbers; **Nunito** (500–800) for everything else. Both from Google Fonts.

| Token | Value | Used for |
|---|---|---|
| ground | `#FAF7F2` | page background |
| ink | `#211B16` | text, keyboard black keys, dark buttons |
| muted | `#6B615A` | secondary text (4.5:1 on ground) |
| line | `#EFE8DF` / `#E6DED4` | card borders (resting / emphasized) |
| tangerine | `#FF8A4C` | primary action, current item, **major** chords |
| tangerine-deep | `#C44A1B` | button shadow, tangerine text on ground |
| teal | `#5BD6B8` | done / correct, **minor** chords |
| teal-deep | `#0F7A66` | listening dot, teal text on ground |
| lavender | `#CDBFFF` | review, XP, **diminished** chords, missed answers |
| lavender-deep | `#5B45B5` | lavender text on ground |
| sun | `#FFD55F` | streak |
| tints | `#FFE3D3` `#E8F8F3` `#F3EFFF` `#FFF4EC` | halos and feedback backgrounds |

Chord quality is color-coded the same way everywhere (pattern chips, lesson, practice strip): major = tangerine, minor = teal, diminished = lavender. Dark text on bright fills; never white on tangerine or teal.

Shapes: cards 20–24px radius with 2px border and a 4px solid drop shadow (`0 4px 0 #E9E0D5`); primary buttons 16px radius, 56–60px tall, `0 5px 0 tangerine-deep`; chips 999px. All tap targets ≥ 44px. No red for mistakes; a miss is lavender because it just means "comes back in review."

## 4. Content model

```ts
type Track = {
  id: string;                      // "major-diatonic-chords"
  title: string;
  map: "circle-of-fifths" | "ladder";
  lesson?: string;                 // markdown shown before level 1 (and on demand)
  stages?: Stage[];                // ladder tracks
  levels?: Level[];                // circle tracks (12, one per key, clockwise from C)
};

type Stage = { id: string; title: string; blurb: string; unlock?: Unlock; levels: Level[] };
type Unlock = { stage: string; level: number };   // "unlocks when <stage> reaches <level>"

type Level = {
  id: string; title: string;       // "a-major", "A major"
  pass?: { correct: number; of: number };   // ear levels: default 8 of 10
  steps: Step[];                   // chord levels: 7 steps, one per diatonic chord
  pool?: Step[];                   // ear levels: questions are drawn from this
};

type Step = {
  label: string;                   // "ii", "P4", "4"
  name: string;                    // "B minor", "Perfect 4th"
  match: Match;
  play?: Sound;                    // what the app plays first (ear tracks)
};

type Match =
  | { type: "chord";    notes: PitchClass[] }                 // any octave, any inversion
  | { type: "voicing";  notes: Note[] }                       // exact notes, for inversions / voice leading
  | { type: "sequence"; notes: Note[]; direction?: "up"|"down" }   // scales
  | { type: "choice";   answer: string; options: string[] }   // name it from a list
  | { type: "root";     note: PitchClass; then?: Match };     // find the key: hit the tonic, then answer

type Sound =
  | { type: "notes";   notes: Note[]; gapMs: number }         // interval: C4 then F4
  | { type: "chord";   notes: Note[] }
  | { type: "cadence"; key: PitchClass; mode: "major"|"minor" }   // I–IV–V–I to establish the key
  | { type: "phrase";  notes: Note[] };                       // find-the-key melody
```

Hints are derived from `match`, never authored: level 1 shows note names, level 2 lights the keys. For `choice` matches the hint is "hear it again" (free, unlimited).

Key-based tracks should be generated from one rule (key → seven chords) rather than written out. A validator should check: every chord step is diatonic to its level's key, every note is on an 88-key range, ids are unique, unlock targets exist.

The first tracks: major diatonic chords, minor diatonic chords (ladder lesson first: i ii° III iv v VI VII), minor scales (sequence), inversions & voice leading (voicing), ear training (ladder: intervals → scale degrees → chord quality → chords in a key → find the key).

## 5. Engine rules

**Today's plan.** Three blocks, about ten minutes: a warm-up (a mastered level, lowest recent score), one new level (next unfinished level on the learner's active track; alternate tracks day to day if more than one is in progress), and one review (the level with the most due steps). An ear block counts as any of the three.

**Review scheduling.** Per step, not per level. A step passed without hints is scheduled further out each time (1, 3, 7, 14, 30 days); a step that needed a hint or was skipped or answered wrong comes back the next day. A level is "mastered" when every step is at 7 days or more.

**MIDI.** Use the Web MIDI API. Listen for note-on events; a chord is matched when the set of currently held pitch classes equals the target (chord match) or the held notes equal the target exactly (voicing). Sequence matches accept notes one at a time in order; a wrong note resets the sequence silently. Always show the held notes lit on the keyboard diagram. If no MIDI device is present, show the "No keyboard? Mark as played" fallback.

**No tempo.** Nothing times out. The time shown on the completion screen is informational only.

**Visibility.** "Show me" has three settings (numerals only / chord names / all chords) and is remembered per track. Hints are always available and never blocked; using one just marks the step for review.

**XP and streak.** 5 XP per step, 40 for a level, 5 for each ear play-back. A day counts toward the streak when any block is completed. No streak freeze mechanics in v1.

**Audio.** Web Audio API with a simple piano-ish envelope (triangle wave, 20 ms attack, exponential release) is enough for v1; a sampled piano can come later.

## 6. Suggested first prompt for Claude Code

> Build Cadence, a local web app, from `design/` and `HANDOFF.md` in this folder. Match the screens in `design/*.dc.html` pixel-for-pixel where practical (fonts, colors, radii, spacing are all in the inline styles). Implement the content model and engine rules from `HANDOFF.md` sections 4 and 5. Generate the major and minor diatonic chord tracks from a key → chords rule, and the ear-training track with the five stages. Use the Web MIDI API for input with the mark-as-played fallback, Web Audio for playback, and store progress in a local JSON file (or localStorage) so a day's plan survives a reload. Start with Today, Practice and Complete; then the circle path; then ear training.
