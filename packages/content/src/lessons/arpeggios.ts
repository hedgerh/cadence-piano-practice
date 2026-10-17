// Arpeggios & chord tones lesson (decisions.md 2026-10-17 "Melody tracks"): a chord's notes
// one at a time, and why they are the strong notes to play over it.
import type { Lesson } from '../types';

export function arpeggiosLesson(): Lesson {
  return {
    title: 'Notes that belong to the chord',
    eyebrow: 'Arpeggios & chord tones · before you play',
    intro:
      'An arpeggio is a chord played one note at a time: root, 3rd, 5th, then the root again an octave up. Those notes are the chord tones.',
    rows: [],
    voicings: [
      {
        label: 'I · C major',
        caption: 'C, E and G: the chord tones of C.',
        notes: ['C4', 'E4', 'G4'],
      },
      {
        label: 'IV · F major',
        caption: 'F, A and C: the chord tones of F.',
        notes: ['F3', 'A3', 'C4'],
      },
    ],
    bridge:
      'When a chord is playing, its chord tones are the **strong notes**: a melody that lands on one at each change sounds sure of itself. Learn where they sit under your hand, chord by chord, and improvising gets much easier.',
    cta: 'Got it — play C major',
    hear: {
      label: 'Hear C major, up and back down',
      sounds: [{ type: 'notes', notes: ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4'], gapMs: 380 }],
    },
  };
}
