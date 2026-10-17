// Melody echo lesson (decisions.md 2026-10-17 "Melody tracks"): hear a phrase, sing it, then
// find it on the keys.
import type { Lesson } from '../types';

export function echoLesson(): Lesson {
  return {
    title: 'Hear it, sing it, play it',
    eyebrow: 'Melody echo · before you play',
    intro:
      'Cadence plays a short phrase in the key. Your job is to play it back. It starts with three notes moving by step and grows to five with skips and leaps.',
    rows: [],
    bridge:
      '**Sing or hum it back first**: if you can sing it, you can find it. Then find the first note (early phrases start on the key’s home note) and follow the line: does it go up or down, by a step or a skip? Play it in **any octave**. A wrong note just starts the phrase again, so replay it as often as you like.',
    cta: 'Got it — start in C major',
    hear: {
      label: 'Hear a phrase',
      sounds: [{ type: 'notes', notes: ['C4', 'D4', 'E4', 'D4'], gapMs: 600 }],
    },
  };
}
