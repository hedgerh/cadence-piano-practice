// Complete.dc.html — A major complete, vii° needed a hint.
import type { RomanChipState } from '../../components/ui/RomanChip';

export const completeFixture = {
  /** Complete:34–35 */
  title: 'A major, complete',
  body: "All seven diatonic chords. That's four keys around the circle.",
  /** Complete:39–45 */
  chips: [
    { numeral: 'I', sub: 'A', state: 'done' },
    { numeral: 'ii', sub: 'Bm', state: 'done' },
    { numeral: 'iii', sub: 'C♯m', state: 'done' },
    { numeral: 'IV', sub: 'D', state: 'done' },
    { numeral: 'V', sub: 'E', state: 'done' },
    { numeral: 'vi', sub: 'F♯m', state: 'done' },
    { numeral: 'vii°', sub: 'G♯° · hint', state: 'hinted' },
  ] satisfies Array<{ numeral: string; sub: string; state: RomanChipState }>,
  /** Complete:49–60 */
  stats: [
    { value: '2:14', label: 'time, no tempo', tone: 'ground' },
    { value: '6 of 7', label: 'chords without a hint', tone: 'ground' },
    { value: '+40 XP', label: 'day 8 streak kept', tone: 'lavender' },
  ] as const,
  /** Complete:64–71 */
  progressLeft: 'Major diatonic chords · 4 of 12 keys',
  progressRight: 'Next on the circle: E major',
  progress: 0.333,
  reviewNote: "G♯° will come back in tomorrow's review until it's clean.",
  cta: 'Keep going — E major',
  done: 'Done for today',
} as const;
