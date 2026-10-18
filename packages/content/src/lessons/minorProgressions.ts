// Minor progressions lesson (decisions.md 2026-10-18 "Minor progressions"): why minor keys
// raise the 7th for V.
import type { Lesson } from '../types';

export function minorProgressionsLesson(): Lesson {
  return {
    title: 'Minor keys borrow a major V',
    eyebrow: 'Minor progressions · before you play',
    intro:
      'In A minor the notes are A B C D E F G, so the chord on the 5th is E minor. It sounds soft, and it doesn’t pull home.',
    rows: [],
    voicings: [
      { label: 'v · Em', caption: 'E G B: the natural minor v.', notes: ['E4', 'G4', 'B4'] },
      { label: 'V · E', caption: 'E G♯ B: raise G to G♯.', notes: ['E4', 'G#4', 'B4'] },
      { label: 'i · Am', caption: 'C E A: G♯ has stepped up to A.', notes: ['C4', 'E4', 'A4'] },
    ],
    bridge:
      'Raise the 7th (G → **G♯** in A minor) and v becomes a **major V**. G♯ sits a half step under A, so it pulls hard toward home. Composers have done this for 400 years. The Andalusian cadence (i–VII–VI–V) and ii°–V–i use it too.',
    cta: 'Got it — play A minor',
    hear: {
      label: 'Hear v – i, then V – i',
      sounds: [
        { type: 'chord', notes: ['E4', 'G4', 'B4'] },
        { type: 'chord', notes: ['C4', 'E4', 'A4'] },
        { type: 'chord', notes: ['E4', 'G#4', 'B4'] },
        { type: 'chord', notes: ['C4', 'E4', 'A4'] },
      ],
    },
  };
}
