// Main.dc.html — Today.
import type { BlockRowProps } from '../../components/ui/BlockRow';

export const mainFixture = {
  /** Main:48 */
  subtitle: 'About 10 minutes today. No tempo, no rush — just play each chord cleanly.',
  /** Main:53–54 */
  planTitle: "Today's practice",
  planMeta: '3 blocks · ~10 min',
  /** Main:57–101 */
  blocks: [
    {
      index: 1,
      state: 'done',
      kind: 'warmup',
      eyebrow: 'Warm-up',
      detail: '2 min · done',
      title: 'C major · all 7 diatonic chords',
      blurb: 'You know this one. Played clean, no hints.',
    },
    {
      index: 2,
      state: 'current',
      kind: 'learn',
      eyebrow: 'Learn · new key',
      detail: '5 min · up next',
      title: 'A major · all 7 diatonic chords',
      blurb: 'Next stop on the circle of fifths. Three sharps: F♯, C♯, G♯.',
    },
    {
      index: 3,
      state: 'upcoming',
      kind: 'review',
      eyebrow: 'Review · due today',
      detail: '2 min',
      title: 'G major · all 7 diatonic chords',
      blurb: "You needed a hint on vii° last time. Let's lock it in.",
      last: true,
    },
  ] satisfies BlockRowProps[],
  /** Main:105–109 */
  cta: 'Continue with A major',
  ctaNote: 'Your keyboard is listening — just play.',
  /** Main:113–165 */
  tracks: {
    major: {
      title: 'Major diatonic chords',
      status: 'In progress',
      progress: 0.25,
      left: '3 of 12 keys · C, G, D',
      right: 'Next: A',
    },
    minor: {
      title: 'Minor diatonic chords',
      status: 'Ready to start',
      progress: 0,
      left: '0 of 12 keys',
      right: 'Starts with a 1-min lesson',
    },
    rows: [
      { title: 'Minor scales', status: 'Not started', available: false },
      { title: 'Inversions & voice leading', status: 'Not started', available: false },
      { title: 'Ear training', status: 'Intervals · Level 3', available: true },
    ],
  },
  addLabel: 'Add something to learn',
} as const;
