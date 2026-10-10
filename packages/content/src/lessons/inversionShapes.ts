// Inversion shapes lesson (decisions.md 2026-10-10 "Voice leading"): C major's three
// positions drawn on the practice keyboard, climbing, with the "find the root" rule.
import type { Note } from '@cadence/music';
import type { Lesson } from '../types';

const POSITIONS: readonly { label: string; caption: string; notes: Note[] }[] = [
  {
    label: 'Root position · I',
    caption: 'C at the bottom: two stacked thirds.',
    notes: ['C3', 'E3', 'G3'],
  },
  {
    label: '1st inversion · I⁶',
    caption: 'E at the bottom: the root has moved to the top.',
    notes: ['E3', 'G3', 'C4'],
  },
  {
    label: '2nd inversion · I⁶₄',
    caption: 'G at the bottom: the root sits in the middle.',
    notes: ['G3', 'C4', 'E4'],
  },
];

export function inversionShapesLesson(): Lesson {
  return {
    title: 'Same notes, new bottom',
    eyebrow: 'Inversion shapes · before you play',
    intro:
      'An inversion is the same three notes stacked from a different bottom note. C major is C, E and G whichever one is lowest — it just changes shape.',
    rows: [],
    voicings: POSITIONS.map((p) => ({ ...p, notes: [...p.notes] })),
    bridge:
      'Find the root: in **1st inversion** it is on top, in **2nd inversion** it is in the middle. Inversions let the next chord sit right under your hand instead of a jump away — that is voice leading.',
    cta: 'Got it — play C major',
    hear: {
      label: 'Hear all three',
      sounds: POSITIONS.map((p) => ({ type: 'chord', notes: [...p.notes] })),
    },
  };
}
