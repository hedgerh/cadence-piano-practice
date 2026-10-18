// engine.md §2.1 — the content model: HANDOFF §4 types plus the minimal extensions
// recorded in docs/decisions.md (Track.blurb/available/lesson, Level.key/blurb/activeOptions,
// Step.id/context/hint/explain/quality, LessonRow.key).
import { type MatchSpec, type Note, type PitchClass, isNote, isPitchClass } from '@cadence/music';
import { z } from 'zod';

export type { MatchSpec } from '@cadence/music';

export const PitchClassSchema = z.custom<PitchClass>(
  (v) => typeof v === 'string' && isPitchClass(v),
  { message: 'Expected a pitch class like "F#" or "Bb"' },
);

export const NoteSchema = z.custom<Note>((v) => typeof v === 'string' && isNote(v), {
  message: 'Expected a note like "F#4" or "Bb3"',
});

export const ModeSchema = z.enum(['major', 'minor']);
export const QualitySchema = z.enum(['major', 'minor', 'diminished']);

export const KeySchema = z.object({ tonic: PitchClassSchema, mode: ModeSchema });

/** HANDOFF §4 Match union (mirrors `MatchSpec` in `@cadence/music`). */
export const MatchSpecSchema: z.ZodType<MatchSpec> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('chord'),
      notes: z.array(PitchClassSchema),
      bass: PitchClassSchema.exactOptional(),
    }),
    z.object({ type: z.literal('voicing'), notes: z.array(NoteSchema) }),
    z.object({
      type: z.literal('sequence'),
      notes: z.array(NoteSchema),
      direction: z.enum(['up', 'down']).exactOptional(),
      anyOctave: z.boolean().exactOptional(),
      shape: z.boolean().exactOptional(),
    }),
    z.object({ type: z.literal('choice'), answer: z.string(), options: z.array(z.string()) }),
    z.object({
      type: z.literal('root'),
      note: PitchClassSchema,
      then: MatchSpecSchema.exactOptional(),
    }),
    z.object({
      type: z.literal('progression'),
      chords: z.array(
        z.object({ notes: z.array(PitchClassSchema), bass: PitchClassSchema.exactOptional() }),
      ),
      maxMove: z.number().int().min(0).exactOptional(),
      freeBass: z.boolean().exactOptional(),
    }),
  ]),
);

/** HANDOFF §4 Sound. A single prompt note is `notes` with one entry. */
export const SoundSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('notes'), notes: z.array(NoteSchema), gapMs: z.number() }),
  z.object({ type: z.literal('chord'), notes: z.array(NoteSchema) }),
  z.object({ type: z.literal('cadence'), key: PitchClassSchema, mode: ModeSchema }),
  z.object({ type: z.literal('phrase'), notes: z.array(NoteSchema) }),
  /** Chords one after another, `gapMs` apart (Name the progression; decisions.md 2026-10-18). */
  z.object({
    type: z.literal('chords'),
    chords: z.array(z.array(NoteSchema)),
    gapMs: z.number(),
  }),
]);

export const StepSchema = z.object({
  /** Stable id, unique within its level; progress key = `${levelId}/${id}`. */
  id: z.string().min(1),
  /** "ii", "P4", "4". */
  label: z.string(),
  /** "B minor", "Perfect 4th". */
  name: z.string(),
  match: MatchSpecSchema,
  /** What the app plays first (ear tracks). */
  play: SoundSchema.exactOptional(),
  /** Played before `play` to establish a key (the "Hear the key" button). */
  context: SoundSchema.exactOptional(),
  /** Played on request as a hint (find the key: the tonic triad). */
  hint: SoundSchema.exactOptional(),
  /** Feedback copy shown after answering. */
  explain: z.string().exactOptional(),
  /** Triad quality, for quality-colored chips. */
  quality: QualitySchema.exactOptional(),
  /**
   * Progression steps: one chip per chord ("I", "IV⁶"), in order, for the progress row
   * (decisions.md 2026-10-10 "Voice leading"). Same length as the match's `chords`.
   */
  parts: z
    .array(
      z.object({
        label: z.string(),
        /** Chord symbol under the numeral: "B♭", "B♭/D" (decisions.md 2026-10-11). */
        sub: z.string().exactOptional(),
        quality: QualitySchema.exactOptional(),
      }),
    )
    .exactOptional(),
});

export const PassSchema = z.object({ correct: z.number().int(), of: z.number().int() });

export const LevelSchema = z.object({
  /** Globally unique: "a-major", "intervals-3". */
  id: z.string().min(1),
  title: z.string(),
  key: KeySchema.exactOptional(),
  blurb: z.string().exactOptional(),
  /**
   * A tip shown on the Practice screen while this level is played ("Relative major: **C major**.
   * …"); `**x**` marks bold text (decisions.md 2026-10-10 "Relative key on scale practice").
   */
  note: z.string().exactOptional(),
  /** Ear levels: 8 of 10 by default; 4 of 5 for find-the-key. */
  pass: PassSchema.exactOptional(),
  /** Chord levels: 7 steps, one per diatonic chord. Ear levels: empty. */
  steps: z.array(StepSchema),
  /** Ear levels: questions are drawn from this. */
  pool: z.array(StepSchema).exactOptional(),
  /** Answer options enabled at this level; the rest render greyed out. */
  activeOptions: z.array(z.string()).exactOptional(),
  /**
   * What copy calls this level's steps when the match types alone don't say ("3 of 8
   * arpeggios", "phrases"); `stepNoun` derives it otherwise (decisions.md 2026-10-17).
   */
  noun: z.enum(['arpeggio', 'phrase']).exactOptional(),
});

/** "Unlocks when <stage> reaches <level>": satisfied when level (N−1) of the stage is passed. */
export const UnlockSchema = z.object({ stage: z.string(), level: z.number().int() });

export const StageSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  blurb: z.string(),
  unlock: UnlockSchema.exactOptional(),
  /**
   * A free practice mode the map offers on this stage ("intervals": pick intervals and
   * directions, nothing recorded; decisions.md 2026-10-11).
   */
  freePractice: z.enum(['intervals']).exactOptional(),
  levels: z.array(LevelSchema),
});

export const LessonChipSchema = z.object({
  numeral: z.string(),
  quality: QualitySchema,
  /** Emphasized ring: where the two rows line up. */
  pivot: z.boolean().exactOptional(),
});

export const LessonRowSchema = z.object({
  /** "Major (you know this)". */
  label: z.string(),
  /** "C major: C · Dm · Em · F · G · Am · B°". */
  caption: z.string(),
  /** The key whose diatonic triads the chips show (validator rule 7). */
  key: KeySchema,
  chips: z.array(LessonChipSchema),
});

export const LessonSchema = z.object({
  title: z.string(),
  eyebrow: z.string(),
  intro: z.string(),
  rows: z.array(LessonRowSchema),
  /**
   * Chord shapes drawn on the practice keyboard, one row each (inversions lesson). Every note
   * stays on C3..B4.
   */
  voicings: z
    .array(z.object({ label: z.string(), caption: z.string(), notes: z.array(NoteSchema) }))
    .exactOptional(),
  /** Callout between the rows; `**x**` marks bold text. */
  bridge: z.string(),
  cta: z.string(),
  hear: z.object({ label: z.string(), sounds: z.array(SoundSchema) }).exactOptional(),
});

export const TrackSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  blurb: z.string(),
  /**
   * Library section the track is listed under ("Chords", "Scales", "Ear training"). Sections
   * appear in the order their first track appears in `buildTracks()`; the map's pills show the
   * current track's group only (decisions.md 2026-10-08 "Track library").
   */
  group: z.string().min(1),
  map: z.enum(['circle-of-fifths', 'ladder']),
  /** false = shown as locked "coming soon" in the pills. */
  available: z.boolean(),
  lesson: LessonSchema.exactOptional(),
  /** Ladder tracks. */
  stages: z.array(StageSchema).exactOptional(),
  /** Circle tracks: 12 levels, one per key, clockwise. */
  levels: z.array(LevelSchema).exactOptional(),
});

export type Key = z.infer<typeof KeySchema>;
export type Quality = z.infer<typeof QualitySchema>;
export type Sound = z.infer<typeof SoundSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Pass = z.infer<typeof PassSchema>;
export type Level = z.infer<typeof LevelSchema>;
export type Unlock = z.infer<typeof UnlockSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type LessonChip = z.infer<typeof LessonChipSchema>;
export type LessonRow = z.infer<typeof LessonRowSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type Track = z.infer<typeof TrackSchema>;
