// EarPath.dc.html — ear-training ladder, stage 1 (Intervals) at level 3 of 6.
import type { StageRowProps } from '../../components/ui/StageRow';

export const earPathFixture = {
  /** EarPath:53–55 */
  eyebrow: 'Track · stage 1 of 5',
  title: 'Ear training',
  blurb:
    'The app plays, you name it, then you play it back. Five stages, each building on the last — from two notes to a whole key.',
  /** EarPath:59–64 */
  howTitle: 'How a level works',
  how: [
    'Ten questions. Replay the sound as often as you like — no penalty.',
    'Name it. Wrong answers show you the right one on the keys.',
    'Play it back on your keyboard to lock it in (+5 XP each).',
    "8 of 10 passes the level. Misses come back in tomorrow's review.",
  ],
  /** EarPath:68–71 */
  upNext: {
    eyebrow: 'Up next',
    title: 'Intervals · Level 3',
    body: 'Adds the perfect 4th and major 2nd to what you know: unison, octave, 5th, major and minor 3rd.',
  },
  cta: 'Start Level 3',
  /** EarPath:82–157 */
  stages: [
    {
      index: 1,
      state: 'current',
      title: 'Intervals',
      meta: 'Level 3 of 6',
      blurb: 'Hear two notes, name the distance. Ascending first, then descending.',
      levels: ['done', 'done', 'current', 'empty', 'empty', 'empty'],
    },
    {
      index: 2,
      state: 'locked',
      title: 'Scale degrees',
      meta: 'Unlocks at Intervals L4',
      blurb: 'Hear a key established, then one note. Name its degree: 1 through 7.',
    },
    {
      index: 3,
      state: 'locked',
      title: 'Chord quality',
      meta: 'Unlocks at Intervals L5',
      blurb: 'Hear one chord on its own. Major, minor or diminished?',
    },
    {
      index: 4,
      state: 'locked',
      title: 'Chords in a key',
      meta: 'Unlocks after Scale degrees L3',
      blurb:
        'Hear a key, then a chord. Name the roman numeral — the same I to vii° you practice by hand.',
    },
    {
      index: 5,
      state: 'locked',
      title: 'Find the key',
      meta: 'Unlocks after Chords in a key L2',
      blurb:
        'Hear a short phrase. Hunt for its home note on your keyboard, then call it major or minor.',
      last: true,
    },
  ] satisfies StageRowProps[],
} as const;
