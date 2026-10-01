// Path.dc.html — circle-of-fifths track map (A major current; C, G, D done).
import type { Quality } from '@cadence/content';
import type { CircleKey } from '../../components/music/CircleOfFifths/CircleOfFifths';
import type { TrackPill } from '../../components/ui/TrackPills';

/** Path:42–46 */
export const trackPills = (active: 'major' | 'ear'): TrackPill[] => [
  {
    id: 'major',
    label: 'Major diatonic chords',
    state: active === 'major' ? 'active' : 'available',
    to: '/tracks/major',
  },
  { id: 'minor', label: 'Minor diatonic chords', state: 'available', to: '/tracks/minor' },
  { id: 'scales', label: 'Minor scales', state: 'locked', to: '/tracks/scales' },
  {
    id: 'inversions',
    label: 'Inversions & voice leading',
    state: 'locked',
    to: '/tracks/inversions',
  },
  {
    id: 'ear',
    label: 'Ear training',
    state: active === 'ear' ? 'active' : 'available',
    to: '/tracks/ear',
  },
];

/** Path:68–74 — the major pattern. */
export const majorPattern: ReadonlyArray<{ numeral: string; quality: Quality }> = [
  { numeral: 'I', quality: 'major' },
  { numeral: 'ii', quality: 'minor' },
  { numeral: 'iii', quality: 'minor' },
  { numeral: 'IV', quality: 'major' },
  { numeral: 'V', quality: 'major' },
  { numeral: 'vi', quality: 'minor' },
  { numeral: 'vii°', quality: 'diminished' },
];

export const pathFixture = {
  /** Path:53–55 */
  eyebrow: 'Track · 3 of 12 keys',
  title: 'Major diatonic chords',
  blurb:
    'One key per level, moving clockwise around the circle of fifths. Each level: play all seven chords of the key.',
  patternTitle: 'The pattern in every major key',
  pattern: majorPattern,
  /** Path:78–82 */
  upNext: {
    eyebrow: 'Up next',
    title: 'A major',
    body: 'Three sharps: F♯ · C♯ · G♯. Chords: A · Bm · C♯m · D · E · F♯m · G♯°',
  },
  cta: 'Start A major',
  review: 'Review a finished key',
  /** Path:104–115 */
  keys: [
    { label: 'C', state: 'done' },
    { label: 'G', state: 'done' },
    { label: 'D', state: 'done' },
    { label: 'A', state: 'current' },
    { label: 'E', state: 'upcoming' },
    { label: 'B', state: 'upcoming' },
    { label: 'Gb', state: 'upcoming', compact: true },
    { label: 'Db', state: 'upcoming' },
    { label: 'Ab', state: 'upcoming' },
    { label: 'Eb', state: 'upcoming' },
    { label: 'Bb', state: 'upcoming' },
    { label: 'F', state: 'upcoming' },
  ] satisfies CircleKey[],
  /** Path:117–128 */
  minors: ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'],
  complete: 3,
} as const;
