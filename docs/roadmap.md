# Roadmap: from building blocks to improvising

The owner's goal: **improvise** — string chords together fluidly and make up melodies over them. This roadmap orders the skills that get there and says how Cadence supports each one. Proposed 2026-10-10 for review; phase 1 is being built on the `voice-leading` branch.

## Phases

Each phase builds on the one before it. ✅ = in Cadence today.

| Phase                        | Skill                                                                                                                                                                        | Why it matters for improvising                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 0 Foundations ✅             | Diatonic triads in every key, major/minor scales; ear: intervals → degrees → chord quality → chords in a key → find the key                                                  | The vocabulary: what chords and notes belong to a key                              |
| **1 Hand shapes & movement** | Inversions as shapes you can find by name; voice leading (shared notes held, the rest move by step); left-hand bass under right-hand chords                                  | Chords connect without the hand jumping, so playing sounds fluid instead of blocky |
| 2 Progression vocabulary     | Common progressions from numerals in any key (I–V–vi–IV, I–vi–IV–V, ii–V–I, i–VI–III–VII, 12-bar blues); hearing and naming them; 7th chords (ii7–V7–Imaj7)                  | Improvising over a progression means knowing it in your hands and ears             |
| 3 Time & comping             | A progression in time over a slow, adjustable loop; broken chords and arpeggios; simple left-hand patterns                                                                   | Real music has a pulse. The first place tempo appears, and only as an opt-in       |
| 4 Melody                     | Major/minor pentatonic and blues scales; chord tones vs passing tones; landing on a chord tone at each change; echo phrases (call and response); motifs: repeat, shift, vary | The raw material of melodic improvisation, and the habit that makes it intentional |
| 5 Improvise                  | Left hand comps a progression while the right hand improvises over a backing loop; record and listen back; chord symbols / lead sheets                                       | The goal itself                                                                    |

## How Cadence helps

**Tracks** stay the graded, no-tempo building blocks (phases 1, 2 and 4). A second experience, **Jam**, covers phases 3 and 5: a looping backing (a progression in a key at a tempo you pick), the keyboard showing chord tones and scale tones as guides, and record/replay. Jam is ungraded and opt-in, so the "no tempo pressure" promise still holds for tracks. The phase 1 work builds Jam's foundations: the progression model, the voice-leading math, and progression playback.

| Phase | Cadence feature                                                                                                                                                                                            | New engine work                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1     | **Voice leading** tracks: Inversion shapes, Smooth progressions, Bass & chords (task 18)                                                                                                                   | `chord.bass`, `progression` match, `voiceLeading.ts`, three-octave keyboard, "Hear it" — **done** |
| 2     | A "Progressions" track (more progressions, minor keys including the harmonic-minor V); an ear stage "name the progression"; 7th-chord tracks                                                               | 7th chords in `@cadence/music`; otherwise content only                                            |
| 3     | Jam v1: loop a progression and play along; optional soft "on the change" feedback                                                                                                                          | a timing clock and loop scheduler                                                                 |
| 4     | Pentatonic/blues scale tracks (content only, `sequence`); an Echo drill (the app plays a phrase, you play it back: `phrase.ts` + `sequence`); a "Target tones" drill (land on a chord tone at each change) | a target-tone match                                                                               |
| 5     | Jam v2: both hands over a backing, chord/scale-tone guides, record and playback                                                                                                                            | MIDI recording and replay                                                                         |
