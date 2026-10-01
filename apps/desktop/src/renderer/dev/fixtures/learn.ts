// Learn.dc.html — the minor pattern lesson.
import type { Quality } from '@cadence/content';

export interface LessonChipFixture {
  numeral: string;
  quality: Quality;
  pivot?: boolean;
}

export const learnFixture = {
  header: { back: 'Tracks', eyebrow: 'Lesson · about 1 minute' },
  /** Learn:31–33 */
  eyebrow: 'Minor diatonic chords · before you play',
  title: 'The minor pattern',
  intro:
    'Every natural minor key uses the same seven chord qualities in the same order — just like major does. Lowercase is minor, uppercase is major, ° is diminished.',
  /** Learn:40–72 */
  rows: [
    {
      label: 'Major (you know this)',
      caption: 'C major: C · Dm · Em · F · G · Am · B°',
      chips: [
        { numeral: 'I', quality: 'major' },
        { numeral: 'ii', quality: 'minor' },
        { numeral: 'iii', quality: 'minor' },
        { numeral: 'IV', quality: 'major' },
        { numeral: 'V', quality: 'major' },
        { numeral: 'vi', quality: 'minor', pivot: true },
        { numeral: 'vii°', quality: 'diminished' },
      ] satisfies LessonChipFixture[],
    },
    {
      label: 'Minor (new)',
      caption: 'A minor: Am · B° · C · Dm · Em · F · G',
      chips: [
        { numeral: 'i', quality: 'minor', pivot: true },
        { numeral: 'ii°', quality: 'diminished' },
        { numeral: 'III', quality: 'major' },
        { numeral: 'iv', quality: 'minor' },
        { numeral: 'v', quality: 'minor' },
        { numeral: 'VI', quality: 'major' },
        { numeral: 'VII', quality: 'major' },
      ] satisfies LessonChipFixture[],
    },
  ],
  /** Learn:56 */
  bridge:
    "Start on **vi** and keep going around. The same seven chords, renumbered from there — that's the minor pattern.",
  cta: 'Got it — play A minor',
  hear: 'Hear both patterns',
} as const;
