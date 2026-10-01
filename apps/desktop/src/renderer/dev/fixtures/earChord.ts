// EarChord.dc.html — Chords in a key L2, G major, answered IV correctly.
import type { AnswerChipState } from '../../components/ui/AnswerChip';
import type { Segment } from '../../components/ui/SegmentedProgress';

export const earChordFixture = {
  header: { back: 'Ear training', title: 'Chords in a key · Level 2', eyebrow: 'Key of G major' },
  /** EarChord:41–52 */
  segments: [
    'done',
    'done',
    'wrong',
    'done',
    'done',
    'done',
    'empty',
    'empty',
    'empty',
    'empty',
  ] satisfies Segment[],
  progress: '5 right · question 6 of 10',
  hearKey: 'Hear the key',
  hearChord: 'Hear the chord again',
  question: 'Which chord did you hear?',
  /** EarChord:75–81 */
  chips: [
    { numeral: 'I', name: 'G', state: 'dimmed' },
    { numeral: 'ii', name: 'Am', state: 'dimmed' },
    { numeral: 'iii', name: 'Bm', state: 'dimmed' },
    { numeral: 'IV', name: 'C', state: 'correct' },
    { numeral: 'V', name: 'D', state: 'dimmed' },
    { numeral: 'vi', name: 'Em', state: 'dimmed' },
    { numeral: 'vii°', name: 'F♯°', state: 'dimmed' },
  ] satisfies Array<{ numeral: string; name: string; state: AnswerChipState }>,
  note: 'Chord names shown — switch to numerals only in Show me, like in practice.',
  /** EarChord:88–92 */
  feedback: {
    title: "IV — yes, that's C major.",
    body: "The IV chord pulls gently away from home. In G, that's C · E · G.",
    playback: 'C · E · G',
  },
  /** EarChord:116 */
  litKeys: ['C4', 'E4', 'G4'],
} as const;
