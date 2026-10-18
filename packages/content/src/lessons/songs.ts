// Songs lesson (decisions.md 2026-10-18 "Songs"): songs are progressions you already know how
// to play smoothly; the left hand takes the bass.
import type { Lesson } from '../types';

export function songsLesson(): Lesson {
  return {
    title: 'Songs are progressions',
    eyebrow: 'Songs · before you play',
    intro:
      'Under the melody, most songs are a handful of chords going round. Let It Be, Don’t Stop Believin’ and Someone Like You all use I, V, vi and IV — the chords you already play in every key.',
    rows: [],
    voicings: [
      {
        label: 'I · C',
        caption: 'Left hand C. Right hand C E G.',
        notes: ['C3', 'C4', 'E4', 'G4'],
      },
      {
        label: 'V · G',
        caption: 'Left hand G. Right hand B D G.',
        notes: ['G3', 'B3', 'D4', 'G4'],
      },
      {
        label: 'vi · Am',
        caption: 'Left hand A. Right hand C E A.',
        notes: ['A3', 'C4', 'E4', 'A4'],
      },
      {
        label: 'IV · F',
        caption: 'Left hand F. Right hand C F A.',
        notes: ['F3', 'C4', 'F4', 'A4'],
      },
    ],
    bridge:
      'This is how pianists accompany a song: the **left hand plays the bass** (usually the root), the **right hand moves smoothly** between chords. Each level is one key; the song’s original key is marked ★. In Someone Like You the V chord has its 3rd in the bass, so the bass walks down a step at a time.',
    cta: 'Got it — play C major',
    hear: {
      label: 'Hear I – V – vi – IV in C',
      sounds: [
        { type: 'chord', notes: ['C3', 'C4', 'E4', 'G4'] },
        { type: 'chord', notes: ['G3', 'B3', 'D4', 'G4'] },
        { type: 'chord', notes: ['A3', 'C4', 'E4', 'A4'] },
        { type: 'chord', notes: ['F3', 'C4', 'F4', 'A4'] },
      ],
    },
  };
}
