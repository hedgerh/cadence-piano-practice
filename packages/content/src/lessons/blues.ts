// 12-bar blues lesson (decisions.md 2026-10-18 "12-bar blues").
import type { Lesson } from '../types';

export function bluesLesson(): Lesson {
  return {
    title: 'Twelve bars, three chords',
    eyebrow: '12-bar blues · before you play',
    intro:
      'The 12-bar blues uses I, IV and V, but every one is a dominant 7th: C7, F7 and G7 in C. Four bars of I, two of IV, two of I, then V, IV, I.',
    rows: [],
    voicings: [
      { label: 'I7 · C7', caption: 'C E G B♭.', notes: ['C4', 'E4', 'G4', 'Bb4'] },
      {
        label: 'IV7 · F7',
        caption: 'C E♭ F A: C stays, the rest step.',
        notes: ['C4', 'Eb4', 'F4', 'A4'],
      },
      { label: 'V7 · G7', caption: 'D F G B.', notes: ['D4', 'F4', 'G4', 'B4'] },
    ],
    bridge:
      'Bar by bar: **C7** C7 C7 C7 · **F7** F7 · **C7** C7 · **G7** · **F7** · **C7** C7. The B♭ in C7 and the E♭ in F7 aren’t in C major — that clash is the blues sound. Voice the chords close together and each note still moves **at most a whole step**.',
    cta: 'Got it — play C major',
    hear: {
      label: 'Hear C7 – F7 – C7 – G7 – F7 – C7',
      sounds: [
        { type: 'chord', notes: ['C4', 'E4', 'G4', 'Bb4'] },
        { type: 'chord', notes: ['C4', 'Eb4', 'F4', 'A4'] },
        { type: 'chord', notes: ['C4', 'E4', 'G4', 'Bb4'] },
        { type: 'chord', notes: ['D4', 'F4', 'G4', 'B4'] },
        { type: 'chord', notes: ['C4', 'Eb4', 'F4', 'A4'] },
        { type: 'chord', notes: ['C4', 'E4', 'G4', 'Bb4'] },
      ],
    },
  };
}
