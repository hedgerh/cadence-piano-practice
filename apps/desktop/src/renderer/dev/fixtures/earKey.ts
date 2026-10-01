// EarKey.dc.html — Find the key L1, home E found after trying G, then A.
import type { Segment } from '../../components/ui/SegmentedProgress';

export const earKeyFixture = {
  header: {
    back: 'Ear training',
    title: 'Find the key · Level 1',
    eyebrow: 'Hunt for home on your keyboard',
  },
  /** EarKey:41–45 */
  segments: ['done', 'current', 'empty', 'empty', 'empty'] satisfies Segment[],
  progress: '1 right · phrase 2 of 5',
  hear: 'Hear the phrase again',
  prompt: 'Eight notes, about four seconds. Replay as often as you like.',
  /** EarKey:61–76 */
  steps: [
    {
      step: 1,
      state: 'done',
      title: 'Home note: E',
      body: 'Found on your third try (you tried G, then A).',
    },
    {
      step: 2,
      state: 'current',
      title: 'Major or minor?',
      body: 'Tip: play E with a major 3rd, then a minor 3rd. Which one matches?',
    },
  ] as const,
  /** EarKey:104–105 */
  home: ['E3', 'E4'],
  tried: ['G3', 'A3'],
  keyboardCaption: 'Your home note stays lit. Everything else you play shows as you play it.',
  /** EarKey:92–94 */
  answers: ['E major', 'E minor'],
  hint: "Hint: hear the phrase's last chord",
} as const;
