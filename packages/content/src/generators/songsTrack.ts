// Songs (decisions.md 2026-10-18 "Songs"): the chord progressions of well-known songs, in every
// major key around the circle, played as pianists accompany a song — left hand on the bass,
// right hand moving each chord note at most a whole step (`progression` + `freeBass`). A step
// in its song's original key is starred. Only chord progressions are used, never melodies or
// lyrics.
import {
  CIRCLE_MAJOR,
  type Key,
  type PitchClass,
  diatonicTriads,
  pcNumber,
  pretty,
} from '@cadence/music';
import { songsLesson } from '../lessons/songs';
import type { Level, Track } from '../types';
import { chordFromTriad, levelBase, progressionStep, triadAt } from './levelBits';
import { MAX_MOVE } from './voiceLeadingTracks';

export const SONGS_GROUP = 'Songs';

interface SongLine {
  id: string;
  song: string;
  line: string;
  /** The song's recorded key (major). */
  original: PitchClass;
  /** Degrees (0 = I), each optionally with the chord tone in the bass (1 = its 3rd). */
  chords: readonly (number | readonly [degree: number, inv: number])[];
}

export const SONG_LINES: readonly SongLine[] = [
  { id: 'let-it-be-verse', song: 'Let It Be', line: 'verse', original: 'C', chords: [0, 4, 5, 3] },
  {
    id: 'let-it-be-second',
    song: 'Let It Be',
    line: 'second line',
    original: 'C',
    chords: [0, 4, 3, 0],
  },
  {
    id: 'dont-stop',
    song: 'Don’t Stop Believin’',
    line: 'verse',
    original: 'E',
    chords: [0, 4, 5, 3],
  },
  {
    id: 'dont-stop-turn',
    song: 'Don’t Stop Believin’',
    line: 'the turn',
    original: 'E',
    chords: [0, 4, 2, 3],
  },
  { id: 'stand-by-me', song: 'Stand By Me', line: 'verse', original: 'A', chords: [0, 5, 3, 4] },
  {
    id: 'someone-like-you',
    song: 'Someone Like You',
    line: 'the bass walks down',
    original: 'A',
    chords: [0, [4, 1], 5, 3],
  },
  {
    id: 'canon-first',
    song: 'Canon in D',
    line: 'first half',
    original: 'D',
    chords: [0, 4, 5, 2],
  },
  {
    id: 'canon-second',
    song: 'Canon in D',
    line: 'second half',
    original: 'D',
    chords: [3, 0, 3, 4],
  },
];

const isOriginal = (line: SongLine, key: Key) => pcNumber(line.original) === pcNumber(key.tonic);

export function songsLevel(key: Key): Level {
  const triads = diatonicTriads(key);
  const originals = [...new Set(SONG_LINES.filter((l) => isOriginal(l, key)).map((l) => l.song))];
  const star =
    originals.length > 0
      ? `★ Original key of ${originals.map((s) => `**${s}**`).join(' and ')}. `
      : `Every song here, moved to ${pretty(key.tonic)} major. `;
  return {
    ...levelBase(key, 'songs', 'Song progressions: left hand on the bass, right hand smooth.'),
    note: `${star}Left hand: the bass note. Right hand: smooth chords, each note moving **at most a whole step**.`,
    steps: SONG_LINES.map((line) =>
      progressionStep({
        id: line.id,
        name: `${line.song} · ${line.line}${isOriginal(line, key) ? ' ★' : ''}`,
        chords: line.chords.map((c) => {
          const [degree, inv] = typeof c === 'number' ? [c, 0] : c;
          const chord = chordFromTriad(triadAt(triads, degree));
          return inv === 0 ? { chord } : { chord, inv };
        }),
        twoHands: true,
        maxMove: MAX_MOVE,
      }),
    ),
  };
}

export function songs(): Track {
  return {
    id: 'songs',
    title: 'Songs',
    blurb:
      'The chord progressions of songs you know, in every key: left hand on the bass, right hand smooth. The original key is starred.',
    group: SONGS_GROUP,
    map: 'circle-of-fifths',
    available: true,
    lesson: songsLesson(),
    levels: CIRCLE_MAJOR.map((tonic) => songsLevel({ tonic, mode: 'major' })),
  };
}
