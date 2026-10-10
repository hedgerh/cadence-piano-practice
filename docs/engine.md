# Engine, content and data model

HANDOFF §4–5 are the source of truth; this document refines them with concrete types, algorithms and the defaults chosen for ambiguities. Section numbers below are referenced from tests and task files.

## 1. `@cadence/music` (pure TS, zero deps)

Conventions: notes are ASCII in data (`"C#4"`, `"Bb3"`), rendered with `♯`/`♭` via `pretty()`. Middle C = `C4` = MIDI 60. 88 keys = MIDI 21..108. Matching converts everything to MIDI numbers / integer pitch classes, so spelling never affects grading.

- `pitch.ts`: `Letter`, `Accidental`, `PitchClass` (`"F#"`), `Note` (`"F#4"`), `Midi`, `Pc` (0..11). `pcNumber`, `noteToMidi` (`"Cb4"` → 59), `midiToPc`, `midiOctave`, `midiToNote(m, spelling)`, `midiToFrequency` (440·2^((m−69)/12)), `pretty`, `inRange88`, `pcName(pc, spelling)` with `Spelling = 'sharps'|'flats'|'default'|{key}` where `'default'` = `C C# D Eb E F F# G Ab A Bb B` (the ear-screen keyboard labels).
- `keys.ts`: `Key = {tonic: PitchClass, mode:'major'|'minor'}` (natural minor throughout v1). `CIRCLE_MAJOR = C G D A E B Gb Db Ab Eb Bb F`; `CIRCLE_MINOR = A E B F# C# G# Eb Bb F C G D` (the design's enharmonic spellings). `scale(key)` (letters cycle from the tonic letter; step pattern major 2212221 / minor 2122122; accidental = ((target − natural + 6) mod 12) − 6). `keySignature(key)` → `{sharps, flats, accidentals[]}`; `keySignatureText(key)` → "Three sharps: F♯, C♯, G♯." / "No sharps or flats." / "Two flats: B♭, E♭."; `relativeMinor/Major`; `keyTitle` ("E♭ minor"); `keySlug` (`a-major`, `eb-minor`, `fs-minor`).
- `triads.ts`: `diatonicTriads(key)` → 7 `Triad { degree, numeral, root, third, fifth, pcs:[Pc,Pc,Pc], quality, name:'B minor', short:'Bm' }`. Stack degrees d, d+2, d+4; quality from (3rd,5th) semitones: (4,7) major, (3,7) minor, (3,6) diminished; numeral upper / lower / lower+°. `MAJOR_NUMERALS = I ii iii IV V vi vii°`, `MINOR_NUMERALS = i ii° III iv v VI VII`.
- `intervals.ts`: 13 intervals `P1 m2 M2 m3 M3 P4 TT P5 m6 M6 m7 M7 P8` → `{id, name, semitones}` (Unison, Minor 2nd, Major 2nd, Minor 3rd, Major 3rd, Perfect 4th, Tritone, Perfect 5th, Minor 6th, Major 6th, Minor 7th, Major 7th, Octave). `intervalBetween`, `transpose`.
- `voicing.ts`: `PRACTICE_RANGE = {low:48 /*C3*/, high:71 /*B4*/}`. **Hint placement rule** (reproduces every design voicing: A3 C♯4 E4 · D3 F♯3 A3 · C♯4 E4 G♯4 · G♯3 B3 D4): root-position triad with the root placed in D3..C♯4: `placeRoot(pc) = 50 + ((pc − 2 + 12) % 12)`. `placeTriad(triad)`, `triadNotes`, `placeScale(key)` (8 notes tonic→tonic), `cadenceVoicing(key)` → I (root pos), IV (2nd inv), V (1st inv), I, each with the chord root an octave below as bass.
- `match.ts`:
  ```ts
  type MatchSpec = HANDOFF §4 Match union (chord | voicing | sequence | choice | root{then?})
  type MatchStatus = 'idle' | 'partial' | 'matched' | 'wrong'
  type MatchInput = { type:'held'; held: ReadonlySet<Midi> } | { type:'noteOn'; midi } | { type:'choose'; option }
  initialMatchState(spec); reduceMatch(spec, state, input)
  ```
  chord = pitch-class set equality (any octave, inversion, doubling); voicing = exact MIDI set; sequence = ordered note-ons, wrong note resets silently (if the wrong note is `target[0]`, restart at index 1), option `anyOctave` for ear play-backs and scales (with `anyOctave` and `direction`, each note after the first must also move that way; `MatchState.played` holds the accepted MIDI notes); root = note-on pitch class equals tonic (tries recorded), then chains into `then`; choice = string equality. `hintFor(spec)` → `{ names: string[], keys: Midi[] } | null` — derived, never authored (level 1 shows names, level 2 lights keys; `choice` → null).

Tests (§1.T): all 24 keys' scales/triads/signatures with hand tables for C, A, G♭, B major and A, E♭, G♯ minor (E♭ minor → `Ebm F° Gb Abm Bbm Cb Db`); `placeTriad` reproduces the four design voicings; matcher table (C major matched by `E3 G3 C4`, by `C4 E4 G4 C5`, not by `C4 E4 G4 A4`, partial on `C4 E4`; voicing rejects inversion; sequence reset semantics; root any octave); `midiToFrequency(69) === 440`.

## 2. `@cadence/content`

### 2.1 Types (zod + inferred TS) — HANDOFF §4 plus minimal extensions (marked +)

```ts
Track  = { id, title, +blurb, map:'circle-of-fifths'|'ladder', +available: boolean, +lesson?: Lesson, stages?: Stage[], levels?: Level[] }
Stage  = { id, title, blurb, unlock?: Unlock, levels: Level[] }
Unlock = { stage, level }           // satisfied when level (N−1) of <stage> is passed; N = levels.length+1 ⇒ stage complete
Level  = { id, title, +key?: {tonic, mode}, +blurb?, pass?: {correct, of}, steps: Step[], pool?: Step[], +activeOptions?: string[] }
Step   = { +id, label, name, match: MatchSpec, play?: Sound, +context?: Sound, +hint?: Sound, +explain?: string, +quality? }
Sound  = notes{notes, gapMs} | chord{notes} | cadence{key, mode} | phrase{notes}
Lesson = { title, eyebrow, intro, rows: [{label, caption, chips:[{numeral, quality, pivot?}]}], bridge, cta, hear?: {label, sounds: Sound[]} }
```

Progress key for a step = `${levelId}/${stepId}`. `pass.of` is the question count (10 default; 5 for find-the-key).

### 2.2 Generators

Content is generated **at runtime in main** from code and validated at startup. A snapshot test freezes the complete list of `${levelId}/${stepId}` so that a content change which would orphan progress rows fails CI.

- `major-diatonic-chords`, `minor-diatonic-chords`: 12 levels over `CIRCLE_MAJOR` / `CIRCLE_MINOR` (minor starts at A minor). `level.id = keySlug`, `title = keyTitle`, `blurb = keySignatureText + " Chords: " + shorts.join(' · ')`. Steps `d1..d7`: `{ label: numeral, name, quality, match:{type:'chord', notes:[root,third,fifth]} }`. The minor track carries the `Lesson` from Learn.dc.html (C major row with pivot `vi`; A minor row with pivot `i`; `hear` = both triad sets).
- `minor-scales` (available): 12 levels; steps `up`/`down` `sequence` via `placeScale`, `anyOctave` with `direction` (decisions.md 2026-10-03 "Minor scales track").
- `inversions-voice-leading` (`available:false`): 12 levels; I/IV/V × root/1st/2nd inversion = 9 `voicing` steps.
- `ear-training` ladder:

| Stage id        | Unlock               | Levels                                                                                                                                                                                                                                                                                                 | pass |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| `intervals`     | —                    | L1 asc {P1,P5,P8}; L2 {P1,m3,M3,P5,P8}; L3 {P1,M2,m3,M3,P4,P5,P8} (design); L4 +{m2,m6,M6}; L5 all 13, roots {C4,D4,E4,F4,G4}; L6 descending all 13 from {C5,B4,A4,G4}. Root C4 for L1–L4. `play: notes gapMs 800`; `match: choice` over all 13 ids; `activeOptions` per level; `explain` "C up to F." | 8/10 |
| `scale-degrees` | `{intervals, 4}`     | L1 C major {1,3,5}; L2 {1..5}; L3 all 7; L4 G and F major all 7. `context: cadence`; `play`: single note in C4–B4; `match: choice '1'..'7'`.                                                                                                                                                           | 8/10 |
| `chord-quality` | `{intervals, 5}`     | L1 maj/min on {C,F,G,D,A,E,Bb}; L2 +dim; L3 all three, 12 roots, inversions 0–2. `play: chord`; `match: choice major/minor/diminished`.                                                                                                                                                                | 8/10 |
| `chords-in-key` | `{scale-degrees, 4}` | L1 C major {I,IV,V,vi}; L2 G major all 7 (design); L3 D & F major; L4 A & E minor. `context: cadence`; `play: chord`; `match: choice` over the mode's numerals; `explain` from an authored table of 14 strings with `{key}` / `{notes}` substitution.                                                  | 8/10 |
| `find-the-key`  | `{chords-in-key, 3}` | L1 tonics {C,D,E,F,G,A} × both modes, phrase ends on tonic; L2 all 12 × both; L3 ends on 3rd/5th. 2 phrases per (tonic, mode). `play: phrase`; `hint: chord` (tonic triad); `match: root{note, then: choice major/minor}`.                                                                             | 4/5  |

Phrases: deterministic seeded PRNG (mulberry32 seeded from a hash of the step id); 8 quarter notes from the key's scale placed in C4–B4; start on 1 or 5; moves = scale step 70% / diatonic 3rd 20% / repeat 10%; ≥3 chord tones; range 55..79.

### 2.3 Validator

`validateTracks(tracks): ValidationError[]` (empty = OK), run in tests and at startup:

1. Unique ids: tracks; levels globally; stages per track; steps per level (steps ∪ pool).
2. Diatonic: every chord/voicing/sequence step in a level with `key` has all pitch classes ⊂ `scale(key)`, and spelled notes ⊂ spelled scale.
3. Range: every `Note` anywhere parses and is 21..108; chord-step hint placements inside `PRACTICE_RANGE`.
4. Unlocks: `unlock.stage` exists in the same track; `1 ≤ unlock.level ≤ target.levels.length + 1`; no cycles; stage 1 has no unlock.
5. Circle tracks: exactly 12 levels, `levels[i].key.tonic === CIRCLE_x[i]`; 7 steps whose labels equal `MAJOR_/MINOR_NUMERALS`.
6. Ear levels: `pass.correct ≤ pass.of`; pool non-empty; `choice.answer ∈ options`; `activeOptions ⊆ options`; every pool answer ∈ activeOptions; `root` has `then`; `phrase` has exactly 8 notes; `gapMs ≥ 0`.
7. Lesson chip qualities match `diatonicTriads` of the referenced keys.

## 3. `@cadence/db` schema

Single local profile (no `user_id`; adding one later is mechanical). Text ids (nanoid), integer epoch-ms timestamps, `YYYY-MM-DD` local dates, enums as text, booleans as integer-mode-boolean, `onConflictDoUpdate` (never `INSERT OR REPLACE`).

| Table            | Columns                                                                                                                                                                                                                                                                                                        | Keys                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `profile`        | `id` ('local'), `name`, `timezone`, `xp_total`, `midi_device_id?`, `midi_device_name?`, `show_mark_played_always`, `created_at`, `updated_at`                                                                                                                                                                  | PK id                                                     |
| `track_settings` | `track_id` PK, `visibility` 'num'\|'name'\|'all' (default 'all'), `active`, `enrolled_at`, `last_new_level_at?`, `lesson_seen_at?`                                                                                                                                                                             |                                                           |
| `step_progress`  | `id`, `track_id`, `level_id`, `step_id`, `interval_index` (−1 none; 0..4 → 1,3,7,14,30), `interval_days`, `due_on?`, `last_result?`, `last_seen_at`, `times_seen`, `times_clean`, `times_hinted`, `times_wrong`, `created_at`, `updated_at`                                                                    | UNIQUE(level_id, step_id); INDEX(due_on); INDEX(level_id) |
| `level_progress` | `level_id` PK, `track_id`, `status` 'available'\|'in_progress'\|'completed', `attempts`, `first_completed_at?`, `last_completed_at?`, `last_score`, `best_score`, `best_time_ms?`, `mastered`, `mastered_at?`, `updated_at`                                                                                    | INDEX(track_id); INDEX(mastered)                          |
| `sessions`       | `id`, `track_id`, `level_id`, `kind` 'warmup'\|'learn'\|'review'\|'free', `plan_block_id?`, `started_at`, `finished_at?`, `duration_ms?`, `steps_total/clean/hinted/skipped/marked/wrong`, `correct?`, `passed?`, `xp_steps`, `xp_level`, `xp_playback`, `question_order?`, `focus?` 'misses', `run?` 'circle' | INDEX(started_at); INDEX(level_id)                        |
| `session_steps`  | `id`, `session_id`, `level_id`, `step_id`, `ordinal`, `result`, `hint_level`, `tries?`, `chosen?`, `played_back`, `elapsed_ms?`, `created_at`                                                                                                                                                                  | UNIQUE(session_id, ordinal)                               |
| `xp_ledger`      | `id`, `amount`, `reason` 'step'\|'level'\|'playback', `session_id?`, `step_id?`, `day`, `created_at`                                                                                                                                                                                                           | INDEX(day)                                                |
| `day_log`        | `day` PK, `blocks_completed`, `sessions_completed`, `xp`, `first_completed_at`                                                                                                                                                                                                                                 |                                                           |
| `daily_plans`    | `day` PK, `generated_at`, `learn_track_id?`                                                                                                                                                                                                                                                                    |                                                           |
| `plan_blocks`    | `id`, `day`, `slot` 0..2, `type` 'warmup'\|'learn'\|'review', `track_id`, `level_id`, `title`, `blurb`, `estimate_min`, `status` 'pending'\|'in_progress'\|'done', `session_id?`, `completed_at?`, `lesson_first`                                                                                              | UNIQUE(day, slot)                                         |

## 4. `@cadence/core` services

All receive `Clock` (`now()`, `today(timezone)`) and repos via `createServices(...)`. Local date via `Intl.DateTimeFormat` in the profile's timezone.

- **ContentService**: `tracks()`, `track(id)`, `level(id)` (global index), `step(levelId, stepId)`, `levelOrder(trackId)` (ladders flattened by stage order), `stageOf(levelId)`.
- **ReviewService** (HANDOFF §5): `INTERVALS = [1,3,7,14,30]`. `clean` → `interval_index = min(idx+1, 4)` (−1 → 0), `due_on = today + INTERVALS[idx]`, `times_clean++`; `hinted|skipped|marked|wrong` → index −1, `interval_days 1`, due tomorrow. `mastered(level)` = every step has `interval_days ≥ 7`. `dueSteps(today)`, `dueCountByLevel(today)`. `reviewNote(level, results)` → "G♯° will come back in tomorrow's review until it's clean." / "G♯° and B° come back tomorrow." / "All seven are clean — next review in 3 days." Scheduling updates on every session regardless of kind.
- **ProgressService**: `startLevel(levelId, kind, planBlockId?)` creates the session (ear: builds `question_order`, see below) and sets `level_progress.status='in_progress'`; if `kind==='learn'` and the level is the track's next new level → `track_settings.last_new_level_at = now`. `finishSession(sessionId, durationMs)` aggregates `session_steps`; chord level complete when every step resolved (clean/hinted/marked/skipped); ear `passed = correct ≥ pass.correct`; updates `level_progress` (`completed` on first completion/pass, `attempts++`, `last_score = clean/total·100` or `correct/of·100`, `best_score`, `best_time_ms`), awards level XP, marks the plan block done (by id, else any pending block today with the same level), logs the day, returns `CompleteDto`. `nextLevel(trackId, levelId)`: circle → next uncompleted level clockwise (wrapping) or null (a circle-run session instead gets the next key in circle order regardless of completion, null after the last; decisions.md 2026-10-03); ladder → next in the same stage, else first level of the next unlocked stage. `trackOverview(trackId)`: circle node states `done|current|upcoming` (current = first uncompleted), completed titles ("C, G, D"), upNext; ladder stage states `locked|open|complete` with generated `unlockText` ("Unlocks at Intervals L4"), per-level `done|current|upcoming|locked`. `isUnlocked(stage)` = no unlock, or passed levels in the target stage ≥ `unlock.level − 1`.
- **Question selection** (ear `sessions.start`, `core/questions.ts`; adaptive since 2026-10-02): partition the pool into **due** (`due_on ≤ today`), **unseen** (no row), **weak** (`last_result = wrong`, or `times_wrong > 0` and `interval_days < 7`), **settled** (`interval_days ≥ 7`, i.e. `interval_index ≥ 2`, and last result clean) and **other**. Build `pass.of` questions: (1) every due + unseen step once (due first; never more than `pass.of`); (2) weak steps get ⌈R × share⌉ appearances each, share = `times_wrong / Σ times_wrong`, R = slots left after (1), at least 2 each when there are ≤ 3 weak steps, at most max(2, ⌊0.4 · pass.of⌋) (a due step that is also weak counts its due appearance); (3) other steps once each; (4) settled steps once each, only when slots remain (zero when the non-settled steps fill the session); (5) still short (small pools): round-robin over the non-settled steps, weak first (each up to the weak cap, then up to ⌈pass.of / 2⌉), and settled steps repeat only when the pool has nothing else. Order: shuffle with no back-to-back repeats and at most 2 consecutive questions sharing an answer; when heavy weighting makes that impossible, keep the best of 200 seeded greedy shuffles (a step holding more than half of what is left is placed first when it fits). Seeded by `levelId:now`, so deterministic per seed.
- **Focus rounds** ("Drill what you missed", ear only): `sessions.start {levelId, kind:'free', focus:'misses'}` restricts the selection pool to the level's steps whose `last_result` is `wrong`/`hinted`, plus on interval levels the same-root steps whose interval is 1 or 2 semitones away among the level's `activeOptions` (the nearest active interval when none is that close, e.g. P8 → P5 on L3); the whole pool when nothing was missed. `pass.of` stays the level's. The session row stores `focus = 'misses'`; it never claims a plan block and is resumed only by another focus start. `finishSession` records step progress, step and play-back XP and the day log (`blocks 0`), but no level XP, no pass/completion (`passed = null`), no `level_progress` attempt/score and no plan-block update; `lastFinishedSession` ignores focus rounds. `CompleteDto.focus` / `SessionDto.focus` carry the flag (`title` "Focus round").
- **XpService**: `STEP=5`, `LEVEL=40`, `PLAYBACK=5`. Step XP for `clean|hinted|marked` and correct ear answers; 0 for `skipped|wrong`. Level XP every time a chord level is finished or an ear level passed. Playback XP once per question, only when the renderer verified the played notes. Ledger write + `profile.xp_total` increment in one transaction. `CompleteDto.xp = { level, steps, playback, total, newTotal }`; the Complete tile shows `level` only (+40), as designed.
- **StreakService**: `logCompletion(day, xp)` upserts `day_log`. Streak = consecutive days ending today with `blocks_completed > 0`; if today has none, count through yesterday and set `atRisk`. Any finished level counts.
- **PlanService** `getToday()`: return the persisted plan for today with live block statuses, else build and persist:
  1. active tracks = enrolled ∧ `available`.
  2. **Learn** = among active tracks with an uncompleted, unlocked level, the one with the smallest `last_new_level_at` (null first; ties by content order) → alternates tracks day to day. `lesson_first` if the track has a lesson not yet seen.
  3. **Review** = level with the most due steps excluding the learn level (tie: earliest `due_on`, then content order). None due → no review block.
  4. **Warm-up** = mastered level with the lowest `last_score` excluding the above (tie: oldest `last_completed_at`). None → no warm-up.
  5. Ear levels fill any slot naturally; no quota.
  6. Estimates: warm-up 2, review 2, learn 5 (chord) / 3 (ear). Blurbs: learn chord → "Next stop on the circle of fifths. " + `keySignatureText` (first key: "Your first key. No sharps or flats."); learn ear → stage blurb + what the level adds; review → "You needed a hint on vii° last time. Let's lock it in." / "vii° and ii are due. Quick pass."; warm-up → "You know this one. Played clean, no hints." / "Last time: 5 of 7 clean."
  7. Nothing to do → one "Free play" warm-up of a random mastered level.
  8. Primary CTA = first block not done: `Start A major` (pending) / `Continue with A major` (in progress) / `Start Intervals · Level 3`; route to the lesson first when `lesson_first`. All done → `{ label: "That's today — explore the tracks", route: '/tracks' }` with subtitle "Come back tomorrow to keep the streak."
     A block becomes `in_progress` when a session is created with its id and `done` when that session finishes with completion/pass.
- **SettingsService**: profile get/update, track settings, `enroll`, `markLessonSeen`. First run: profile with name from onboarding, timezone from `Intl`, enroll `major-diatonic-chords` + `ear-training`.

Tests (§4.T) with `FakeClock` and in-memory repos: scheduler table (clean ×5 → 1,3,7,14,30; hinted resets); mastery; streak across local midnight (23:30 vs 00:30 in America/Los_Angeles); plan edge cases (first day → learn only; nothing due → no review; alternation over two days; all-done CTA); seed `day8` reproduces the design's Today exactly (warm-up C major done, learn A major, review G major vii°, 8-day streak, 1,240 XP, Intervals L3).

## 5. Renderer session machines

- **Practice** (`practiceReducer`): `phase: listening|matched|advancing|finished`; `current`, `hint 0..2`, `armed`, `queue` (once-skipped), `results[]`, timer. `HELD_CHANGED` → if empty set `armed=true`; if armed and `reduceMatch` is `matched` → push result (`hint>0 ? 'hinted' : 'clean'`) → `matched` (target keys teal) → 600 ms → `advancing` (effect: `sessions.recordStep`) → next in order then queue → `listening` or `finished`. `HINT` (`min(2, hint+1)`; labels "Give me a hint" / "Show it on the keys" / "That is all the hints"), `SKIP` (first skip → queue; second → `skipped`), `MARK_PLAYED` (`marked`), `SET_VIS` (persisted via `tracks.setSettings`, optimistic). Timer starts on the first note-on or first hint/skip/mark. Resume from `sessions.get` on reload. "Finish the key" → `sessions.finish` → `/complete/:sessionId`.
- **Ear** (`earDrillReducer`): `phase: idle|listening|answered|done`; `q`, `questions[]` (from `SessionDto`), `played`, `chosen`, `correct`, `playedBack`, `hinted`, `results[]`, KeyDrill `root:{found, tries[]}`. Auto-play 300 ms after a question appears; answers disabled until the first play finishes; replay free. `PICK` → `answered` + `recordStep` (`clean` / `hinted` / `wrong`); play-back detection (`sequence anyOctave` for intervals, `chord` for chords) → `recordPlayback` once; `NEXT`; after the last → `done` → `sessions.finish` → `/ear/results/:id`.

## 6. Resolved ambiguities (defaults)

1. **Skipped steps** return once at the end of the level; a second skip resolves `skipped` (0 XP, due tomorrow) and still counts toward completion.
2. **Hinted and mark-as-played** steps earn the 5 step XP; only skipped/wrong earn 0. Marked is not clean.
3. **Mark as played** hidden while a MIDI input is connected; `showMarkPlayedAlways` overrides.
4. **Practice strip** colors = progress state (as designed). Quality colors apply to pattern chips (Path/Learn) and Complete chips.
5. **Held-note color** = `sun`; priority `correct > home > hint > held > tried`.
6. **Correct match**: teal flash ~600 ms, auto-advance; next step does not match until all keys are released. Sustain pedal ignored.
7. **Timer** starts on the first note-on or first hint/skip/mark; stops on the last resolve; shown `m:ss`.
8. **"Keep going"** → next uncompleted key's Practice (reusing today's plan block if it matches). "Done for today" → Today.
9. **Unlock** `{S, N}` satisfied when level N−1 of S is passed; copy generated from the Unlock.
10. **Ear answers** disabled until the first auto-play finishes; replay free and unlimited.
11. **Play-back** optional, MIDI only, +5 once per question only when the notes match; not offered for cadence/phrase.
12. **Answer counting** happens when chosen; the segment turns teal/lavender immediately.
13. **Find the key**: unlimited tries; clean only if found within 2 tries with no hint; hint always available and marks hinted; home lights every octave of the tonic; tried keys faint in the octave played.
14. **5-question levels** pass at 4/5.
15. **Default enrolment**: major chords + ear training; minor chords "Ready to start", enrolls on click.
16. Fonts bundled; fully offline.
17. Window 1280×820 default, min 1100×720; keyboard (661px) and circle (580px) fixed-size.

## 7. Audio

`Synth` interface: `unlock()`, `play(sound, opts)`, `playMidi(notes, at, dur)`, `stop()`, `setVolume()`. `WebAudioSynth` voice: the profile's Sound setting (decisions.md 2026-10-11 "Sound setting"): `samples` (default) — the recorded grand piano once decoded (decisions.md 2026-10-07 "Piano voice"); `synth` — the additive piano in `pianoSynth.ts`; `tone` — and the fallback while samples are missing — a triangle oscillator → gain (`setValueAtTime(0.0001, t)`, `exponentialRampToValueAtTime(0.25, t+0.02)`, `exponentialRampToValueAtTime(0.0001, t+dur)`, `stop(t+dur+0.05)`) → master gain → `DynamicsCompressorNode` (−12 dB, ratio 4) → destination. Schedules (`t0 = currentTime + 0.05`): `notes` at `gapMs` with dur 0.7 s (last 0.9 s); `chord` 1.2 s; `cadence` `cadenceVoicing(key)` at 0.65 s spacing (~3 s); `phrase` 8 × 0.5 s (~4 s). `NullSynth` records calls for tests. `player.ts` maps content `Sound` → `Synth`.
