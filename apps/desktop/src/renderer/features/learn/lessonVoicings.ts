// decisions.md 2026-10-10 "Voice leading": which chord-shape tile a lesson's "Hear" sound is.
import type { Lesson } from '@cadence/content';
import { noteToMidi, type Note } from '@cadence/music';

/** The voicing (by index) whose notes the hear sound at `sounding` plays, or null. */
export function voicingForSound(lesson: Lesson, sounding: number | null): number | null {
  if (sounding === null || !lesson.voicings) return null;
  const sound = lesson.hear?.sounds[sounding];
  if (!sound || sound.type === 'cadence') return null;
  const key = (notes: readonly Note[]) =>
    notes
      .map(noteToMidi)
      .sort((a, b) => a - b)
      .join();
  const i = lesson.voicings.findIndex((v) => key(v.notes) === key(sound.notes));
  return i < 0 ? null : i;
}
