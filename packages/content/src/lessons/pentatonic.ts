// Pentatonic and blues scale lessons (decisions.md 2026-10-18 "Pentatonic and blues scales").
import type { Lesson } from '../types';

export function pentatonicLesson(): Lesson {
  return {
    title: 'Five notes, no wrong ones',
    eyebrow: 'Pentatonic scales · before you play',
    intro:
      'Take the major scale and leave out the 4th and the 7th: C D E G A. Those two were the notes that clash, so what is left sounds good over almost any chord in the key.',
    rows: [],
    voicings: [
      {
        label: 'C major pentatonic',
        caption: 'C D E G A, from C.',
        notes: ['C4', 'D4', 'E4', 'G4', 'A4'],
      },
      {
        label: 'A minor pentatonic',
        caption: 'The same five notes, from A.',
        notes: ['A3', 'C4', 'D4', 'E4', 'G4'],
      },
    ],
    bridge:
      'The **relative minor** (on the 6th) uses the **same five notes**: C major pentatonic and A minor pentatonic are one set of keys. That is why it is the first scale most players improvise with.',
    cta: 'Got it — play C major',
    hear: {
      label: 'Hear C major pentatonic',
      sounds: [{ type: 'notes', notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'], gapMs: 350 }],
    },
  };
}

export function bluesScaleLesson(): Lesson {
  return {
    title: 'One blue note',
    eyebrow: 'Blues scale · before you play',
    intro:
      'The blues scale is the minor pentatonic (A C D E G) plus one more note squeezed between the 4th and the 5th: E♭, the flat 5th.',
    rows: [],
    voicings: [
      {
        label: 'A blues scale',
        caption: 'A C D E♭ E G.',
        notes: ['A3', 'C4', 'D4', 'Eb4', 'E4', 'G4'],
      },
    ],
    bridge:
      'The **blue note** sounds tense on its own. Slide through it, D → E♭ → E, and you get the sound of every blues solo. It works over all three chords of a 12-bar blues.',
    cta: 'Got it — play A minor',
    hear: {
      label: 'Hear the A blues scale',
      sounds: [{ type: 'notes', notes: ['A3', 'C4', 'D4', 'Eb4', 'E4', 'G4', 'A4'], gapMs: 350 }],
    },
  };
}
