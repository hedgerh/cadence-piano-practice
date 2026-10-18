// Jam presets (decisions.md 2026-10-18 "Jam"; docs/roadmap.md phases 3 and 5): the progressions
// Jam can loop, as content. Jam itself is ungraded; the engine only plays what these charts say.
import {
  CIRCLE_MAJOR,
  CIRCLE_MINOR,
  type Key,
  type PitchClass,
  bluesScale,
  diatonicSevenths,
  diatonicTriads,
  dominantSeventhOn,
  harmonicTriads,
  majorPentatonic,
  minorPentatonic,
  pcName,
  pcNumber,
  scale,
  spellableMinor,
} from '@cadence/music';
import { spellableBlues } from './generators/bluesTrack';
import type { Quality } from './types';

/** Which notes Jam lights as "scale tones" while a preset plays. */
export type JamGuide = 'major' | 'minor' | 'majorPentatonic' | 'minorPentatonic' | 'blues';

export interface JamPresetChord {
  /** 0 = I (i). */
  degree: number;
  /** triad (default), the diatonic 7th, or a dominant 7th on that degree (blues). */
  kind?: 'triad' | 'seventh' | 'dominant';
  bars: number;
}

export interface JamPreset {
  id: string;
  title: string;
  /** One line: what it is and where you've heard it. */
  blurb: string;
  mode: 'major' | 'minor';
  chords: readonly JamPresetChord[];
  guide: JamGuide;
}

const c = (degree: number, bars = 1, kind?: JamPresetChord['kind']): JamPresetChord =>
  kind === undefined ? { degree, bars } : { degree, bars, kind };

export const JAM_PRESETS: readonly JamPreset[] = [
  {
    id: 'four-chord-pop',
    title: 'Four-chord pop',
    blurb: 'I–V–vi–IV: Let It Be, Don’t Stop Believin’, a thousand others.',
    mode: 'major',
    chords: [c(0), c(4), c(5), c(3)],
    guide: 'majorPentatonic',
  },
  {
    id: 'fifties',
    title: 'Fifties',
    blurb: 'I–vi–IV–V: Stand By Me, Heart and Soul.',
    mode: 'major',
    chords: [c(0), c(5), c(3), c(4)],
    guide: 'majorPentatonic',
  },
  {
    id: 'canon',
    title: 'Canon',
    blurb: 'I–V–vi–iii–IV–I–IV–V: Pachelbel’s eight chords.',
    mode: 'major',
    chords: [c(0), c(4), c(5), c(2), c(3), c(0), c(3), c(4)],
    guide: 'major',
  },
  {
    id: 'two-five-one',
    title: 'ii–V–I',
    blurb: 'ii7–V7–Imaj7 with 7th chords: the jazz cadence.',
    mode: 'major',
    chords: [c(1, 1, 'seventh'), c(4, 1, 'seventh'), c(0, 2, 'seventh')],
    guide: 'major',
  },
  {
    id: 'twelve-bar-blues',
    title: '12-bar blues',
    blurb: 'I7 ×4, IV7 ×2, I7 ×2, V7, IV7, I7 ×2: improvise with the blues scale.',
    mode: 'major',
    chords: [
      c(0, 4, 'dominant'),
      c(3, 2, 'dominant'),
      c(0, 2, 'dominant'),
      c(4, 1, 'dominant'),
      c(3, 1, 'dominant'),
      c(0, 2, 'dominant'),
    ],
    guide: 'blues',
  },
  {
    id: 'epic-minor',
    title: 'Epic minor',
    blurb: 'i–VI–III–VII: the big minor-key pop loop.',
    mode: 'minor',
    chords: [c(0), c(5), c(2), c(6)],
    guide: 'minorPentatonic',
  },
  {
    id: 'andalusian',
    title: 'Andalusian',
    blurb: 'i–VII–VI–V: stepping down to a major V.',
    mode: 'minor',
    chords: [c(0), c(6), c(5), c(4)],
    guide: 'minor',
  },
];

export interface JamChord {
  /** "Am", "G7", "Cmaj7". */
  symbol: string;
  /** "vi", "V7", "Imaj7". */
  numeral: string;
  /** Chord tones, root first. */
  notes: PitchClass[];
  /** The left-hand bass (the root). */
  bass: PitchClass;
  bars: number;
  quality: Quality;
}

export interface JamChart {
  key: Key;
  chords: JamChord[];
  /** The guide scale's notes, tonic first. */
  scale: PitchClass[];
  /** Bars in one loop. */
  bars: number;
}

/** The 12 tonics a preset can be played in, circle order. */
export function jamTonics(preset: Pick<JamPreset, 'mode'>): readonly PitchClass[] {
  return preset.mode === 'major' ? CIRCLE_MAJOR : CIRCLE_MINOR;
}

/**
 * A preset in a key: the chords spelled in that key (a minor key's V is major; G♯ minor plays
 * as A♭ minor and G♭ blues as F♯, so nothing needs a double accidental).
 */
export function jamChart(preset: JamPreset, tonic: PitchClass): JamChart {
  const asked: Key = { tonic, mode: preset.mode };
  const blues = preset.chords.some((ch) => ch.kind === 'dominant');
  const key =
    preset.mode === 'minor' ? spellableMinor(asked) : blues ? spellableBlues(asked) : asked;
  const triads = preset.mode === 'minor' ? harmonicTriads(key) : diatonicTriads(key);
  const sevenths = diatonicSevenths(key);
  const names = scale(key);
  const chords = preset.chords.map((ch): JamChord => {
    if (ch.kind === 'seventh' || ch.kind === 'dominant') {
      const s =
        ch.kind === 'seventh'
          ? sevenths[ch.degree]
          : dominantSeventhOn(names[ch.degree] ?? key.tonic, ch.degree + 1);
      if (s === undefined) throw new RangeError(`no 7th on degree ${ch.degree + 1}`);
      return {
        symbol: s.short,
        numeral: s.numeral,
        notes: [s.root, s.third, s.fifth, s.seventh],
        bass: s.root,
        bars: ch.bars,
        quality: s.triadQuality,
      };
    }
    const t = triads[ch.degree];
    if (t === undefined) throw new RangeError(`no triad on degree ${ch.degree + 1}`);
    return {
      symbol: t.short,
      numeral: t.numeral,
      notes: [t.root, t.third, t.fifth],
      bass: t.root,
      bars: ch.bars,
      quality: t.quality,
    };
  });
  return {
    key,
    chords,
    scale: guideScale(preset.guide, key),
    bars: chords.reduce((n, ch) => n + ch.bars, 0),
  };
}

function guideScale(guide: JamGuide, key: Key): PitchClass[] {
  switch (guide) {
    case 'major':
    case 'minor':
      return scale(key);
    case 'majorPentatonic':
      return majorPentatonic(key);
    case 'minorPentatonic':
      return minorPentatonic(key);
    case 'blues': {
      // The blues scale on the key's tonic, over the major-key dominants. D♭ minor needs B𝄫,
      // so a flat tonic that can't carry a minor scale uses its sharp twin (C♯).
      const minor: Key = { tonic: key.tonic, mode: 'minor' };
      try {
        return bluesScale(minor);
      } catch {
        return bluesScale({ tonic: pcName(pcNumber(key.tonic), 'sharps'), mode: 'minor' });
      }
    }
  }
}
