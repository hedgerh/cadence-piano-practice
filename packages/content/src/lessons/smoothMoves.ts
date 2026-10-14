// Smooth progressions lesson (decisions.md 2026-10-10 "Voice leading"): I → IV → V voiced
// nearest to each other, so shared notes stay and the rest step.
import type { Note } from '@cadence/music';
import type { Lesson } from '../types';

const MOVES: readonly { label: string; caption: string; notes: Note[] }[] = [
  { label: 'I · C major', caption: 'Start here: C, E, G.', notes: ['C4', 'E4', 'G4'] },
  {
    label: 'IV · F major',
    caption: 'C stays. E steps up to F, G steps up to A.',
    notes: ['C4', 'F4', 'A4'],
  },
  {
    label: 'V · G major',
    caption: 'From I: G stays. C steps down to B, E steps down to D.',
    notes: ['B3', 'D4', 'G4'],
  },
];

export function smoothMovesLesson(): Lesson {
  return {
    title: 'Keep what you share',
    eyebrow: 'Smooth progressions · before you play',
    intro:
      'Jumping every chord back to root position makes your hand leap around. Pianists instead move each finger as little as possible to reach the next chord.',
    rows: [],
    voicings: MOVES.map((m) => ({ ...m, notes: [...m.notes] })),
    bridge:
      'The rule: notes the two chords **share stay down**, and every other note moves **by a step** (at most a whole step). Any shape that follows the rule counts. When two chords share **nothing** (IV → V), every note moves: slide the whole shape to the nearest notes and listen to the top note climb.',
    cta: 'Got it — play C major',
    hear: {
      label: 'Hear I – IV – I – V – I',
      sounds: [
        { type: 'chord', notes: ['C4', 'E4', 'G4'] },
        { type: 'chord', notes: ['C4', 'F4', 'A4'] },
        { type: 'chord', notes: ['C4', 'E4', 'G4'] },
        { type: 'chord', notes: ['B3', 'D4', 'G4'] },
        { type: 'chord', notes: ['C4', 'E4', 'G4'] },
      ],
    },
  };
}
