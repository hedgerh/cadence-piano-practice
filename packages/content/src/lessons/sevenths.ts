// 7th chord lessons (decisions.md 2026-10-18 "7th chords").
import type { Lesson } from '../types';

/** Diatonic 7th chords: stack one more third on each triad. */
export function seventhsLesson(): Lesson {
  return {
    title: 'Add one more third',
    eyebrow: 'Diatonic 7th chords · before you play',
    intro:
      'A 7th chord is a triad with one more note stacked a third higher: root, 3rd, 5th, 7th. Built from the major scale, the four kinds fall in place.',
    rows: [],
    voicings: [
      {
        label: 'Imaj7 · Cmaj7',
        caption: 'Major triad, major 7th: dreamy.',
        notes: ['C4', 'E4', 'G4', 'B4'],
      },
      {
        label: 'ii7 · Dm7',
        caption: 'Minor triad, minor 7th: mellow.',
        notes: ['D3', 'F3', 'A3', 'C4'],
      },
      {
        label: 'V7 · G7',
        caption: 'Major triad, minor 7th: wants to go home.',
        notes: ['G3', 'B3', 'D4', 'F4'],
      },
      {
        label: 'viiø7 · Bø7',
        caption: 'Diminished triad, minor 7th: half-diminished.',
        notes: ['B3', 'D4', 'F4', 'A4'],
      },
    ],
    bridge:
      'Every major key has the same pattern: **maj7** on I and IV, **m7** on ii, iii and vi, a **dominant 7** on V and **ø7** on vii. Play them in any octave and any order — the chip colours still follow the triad underneath.',
    cta: 'Got it — play C major',
    hear: {
      label: 'Hear Cmaj7, Dm7, G7',
      sounds: [
        { type: 'chord', notes: ['C4', 'E4', 'G4', 'B4'] },
        { type: 'chord', notes: ['D3', 'F3', 'A3', 'C4'] },
        { type: 'chord', notes: ['G3', 'B3', 'D4', 'F4'] },
      ],
    },
  };
}

/** ii–V–I: the 7th falls to the 3rd, two notes stay. */
export function twoFiveOneLesson(): Lesson {
  return {
    title: 'The 7th falls to the 3rd',
    eyebrow: 'ii–V–I · before you play',
    intro:
      'ii–V–I is the most common move in jazz and a lot of pop. With 7th chords it nearly plays itself: two notes stay down, and the others step.',
    rows: [],
    voicings: [
      {
        label: 'ii7 · Dm7',
        caption: 'C D F A: Dm7 with its 7th lowest.',
        notes: ['C4', 'D4', 'F4', 'A4'],
      },
      {
        label: 'V7 · G7',
        caption: 'D and F stay. A steps to G, C falls to B (the 3rd).',
        notes: ['B3', 'D4', 'F4', 'G4'],
      },
      {
        label: 'Imaj7 · Cmaj7',
        caption: 'G and B stay. F falls to E (the 3rd), D steps to C.',
        notes: ['B3', 'C4', 'E4', 'G4'],
      },
    ],
    bridge:
      'The rule that makes it smooth: **the 7th of each chord falls a step to the 3rd of the next**. C (7th of Dm7) → B (3rd of G7); F (7th of G7) → E (3rd of Cmaj7). Every voice moves **at most a whole step**.',
    cta: 'Got it — play C major',
    hear: {
      label: 'Hear Dm7 – G7 – Cmaj7',
      sounds: [
        { type: 'chord', notes: ['C4', 'D4', 'F4', 'A4'] },
        { type: 'chord', notes: ['B3', 'D4', 'F4', 'G4'] },
        { type: 'chord', notes: ['B3', 'C4', 'E4', 'G4'] },
      ],
    },
  };
}
