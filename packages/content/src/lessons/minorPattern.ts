// engine.md §2.1 Lesson, §2.2 — "The minor pattern", copy from Learn.dc.html lines 23–89:
// C major row with pivot on vi, A minor row with pivot on i; "Hear both patterns" plays
// both triad sets in chip order.
import { type Key, diatonicTriads, keyTitle, triadNotes } from '@cadence/music';
import type { Lesson, LessonRow, Sound } from '../types';

const C_MAJOR: Key = { tonic: 'C', mode: 'major' };
const A_MINOR: Key = { tonic: 'A', mode: 'minor' };

function row(label: string, key: Key, pivot: string): LessonRow {
  const triads = diatonicTriads(key);
  return {
    label,
    caption: `${keyTitle(key)}: ${triads.map((t) => t.short).join(' · ')}`,
    key: { tonic: key.tonic, mode: key.mode },
    chips: triads.map((t) =>
      t.numeral === pivot
        ? { numeral: t.numeral, quality: t.quality, pivot: true }
        : { numeral: t.numeral, quality: t.quality },
    ),
  };
}

function triadSounds(key: Key): Sound[] {
  return diatonicTriads(key).map((t) => ({ type: 'chord', notes: triadNotes(t) }));
}

export function minorPatternLesson(): Lesson {
  return {
    title: 'The minor pattern',
    eyebrow: 'Minor diatonic chords · before you play',
    intro:
      'Every natural minor key uses the same seven chord qualities in the same order — just like major does. Lowercase is minor, uppercase is major, ° is diminished.',
    rows: [row('Major (you know this)', C_MAJOR, 'vi'), row('Minor (new)', A_MINOR, 'i')],
    bridge:
      "Start on **vi** and keep going around. The same seven chords, renumbered from there — that's the minor pattern.",
    cta: 'Got it — play A minor',
    hear: {
      label: 'Hear both patterns',
      sounds: [...triadSounds(C_MAJOR), ...triadSounds(A_MINOR)],
    },
  };
}
