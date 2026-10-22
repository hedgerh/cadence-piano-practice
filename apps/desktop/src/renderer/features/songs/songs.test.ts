// decisions.md 2026-10-21 "Songs from MIDI": timing through the tempo map, Wait-mode steps and
// grading, the pedal, chord names, and the play-along scheduler.
import { describe, expect, it } from 'vitest';
import { NullSynth } from '../../audio/NullSynth';
import {
  barAt,
  barRange,
  beatAtSec,
  chordName,
  keyboardRange,
  pedalDownAt,
  secAt,
  songSteps,
  withPedal,
  type Song,
} from './songModel';
import { SongPlayer } from './SongPlayer';
import { startWait, waitNoteOn } from './waitMode';

const n = (beat: number, midi: number, dur = 1, velocity = 80) => ({ beat, dur, midi, velocity });

/** Bars 1–2 in 4/4 at 120, bar 3 in 2/4, bar 4 in 4/4; the tempo drops to 60 at beat 8. */
const song: Song = {
  id: 'test-song',
  title: 'Test',
  fileName: 'test.mid',
  importedAt: 0,
  tempos: [
    { beat: 0, bpm: 120 },
    { beat: 8, bpm: 60 },
  ],
  bars: [
    { number: 1, beat: 0, beats: 4, num: 4, den: 4 },
    { number: 2, beat: 4, beats: 4, num: 4, den: 4 },
    { number: 3, beat: 8, beats: 2, num: 2, den: 4 },
    { number: 4, beat: 10, beats: 4, num: 4, den: 4 },
  ],
  left: [n(0, 36, 4), n(4, 43, 4), n(8, 41, 2)],
  right: [n(0, 60), n(0, 64), n(0.01, 67), n(1, 62), n(4, 62), n(4, 67), n(4, 71), n(8, 65)],
  pedal: [
    { beat: 0, down: true },
    { beat: 3, down: false },
  ],
  lengthBeats: 10,
};

describe('time', () => {
  it('seconds through tempo changes, and back', () => {
    expect(secAt(song, 4)).toBe(2);
    expect(secAt(song, 8)).toBe(4);
    expect(secAt(song, 9)).toBe(5); // 60 BPM after beat 8
    expect(beatAtSec(song, 5)).toBe(9);
    expect(beatAtSec(song, 1)).toBe(2);
  });

  it('bars across the 2/4 bar', () => {
    expect(barAt(song, 9)).toEqual({ number: 3, beatInBar: 1 });
    expect(barAt(song, 10.5)).toEqual({ number: 4, beatInBar: 0.5 });
    expect(barRange(song, 2, 3)).toEqual({ start: 4, end: 10 });
  });
});

describe('steps and Wait mode', () => {
  it('a step is every key struck together by the chosen hands (a rolled chord counts as one)', () => {
    const right = songSteps(song, 'right', 0, 8);
    expect(right.map((s) => [s.beat, s.notes.map((x) => x.midi)])).toEqual([
      [0, [60, 64, 67]],
      [1, [62]],
      [4, [62, 67, 71]],
    ]);
    const both = songSteps(song, 'both', 0, 8);
    expect(both[0]?.notes).toEqual([
      { midi: 36, hand: 'left' },
      { midi: 60, hand: 'right' },
      { midi: 64, hand: 'right' },
      { midi: 67, hand: 'right' },
    ]);
  });

  it('waits for every exact key; a wrong key is shown, not punished; the range loops', () => {
    const steps = songSteps(song, 'right', 0, 2);
    let s = startWait();
    let r = waitNoteOn(steps, s, 60);
    s = r.state;
    expect(r.completed).toBeNull();
    r = waitNoteOn(steps, s, 76); // E5: the right letter, wrong octave
    s = r.state;
    expect(s).toMatchObject({ wrong: 76, hit: [60], index: 0 });
    s = waitNoteOn(steps, s, 64).state;
    r = waitNoteOn(steps, s, 67);
    expect(r.completed).toBe(0);
    expect(r.state).toMatchObject({ index: 1, hit: [], wrong: null });
    r = waitNoteOn(steps, r.state, 62);
    expect(r.state).toMatchObject({ index: 0, loops: 1 });
  });
});

describe('pedal, keyboard, names', () => {
  it('a key let go under the pedal rings until the pedal comes up', () => {
    expect(withPedal([n(0, 60, 1), n(4, 62, 1)], song.pedal).map((x) => x.dur)).toEqual([3, 1]);
    expect(pedalDownAt(song.pedal, 2)).toBe(true);
    expect(pedalDownAt(song.pedal, 3)).toBe(false);
  });

  it('the keyboard covers every note from the C below', () => {
    expect(keyboardRange(song)).toEqual({ startMidi: 36, octaves: 3 }); // C2..B4
    expect(keyboardRange({ left: [n(0, 26)], right: [n(0, 87)] })).toEqual({
      startMidi: 24,
      octaves: 6,
    });
  });

  it('names chords as a guide, with slash basses', () => {
    expect(chordName([51, 55, 60])).toBe('Cm/E♭'); // E♭3 G3 C4 — Delilah's opening shape
    expect(chordName([39, 51, 55, 58])).toBe('E♭');
    expect(chordName([43, 65, 69, 72])).toBe('F/G'); // G under F A C
    expect(chordName([43, 62, 65, 69, 72])).toBe('Dm7/G'); // Delilah bar 5: G under D F A C
    expect(chordName([62, 65, 69, 72])).toBe('Dm7');
    expect(chordName([60])).toBeNull();
  });
});

describe('SongPlayer', () => {
  const play = (opts: Partial<Parameters<SongPlayer['start']>[0]> = {}) => {
    const synth = new NullSynth();
    const player = new SongPlayer(synth, song);
    player.start({
      notes: song.left,
      startBeat: 0,
      endBeat: 8,
      speed: 1,
      loop: false,
      click: false,
      countIn: false,
      at: 1,
      ...opts,
    });
    return { synth, player };
  };
  const run = (synth: NullSynth, player: SongPlayer, until: number) => {
    for (let t = 0; t <= until; t += 0.05) {
      synth.time = t;
      player.pump();
    }
  };

  it('plays each note once at its time and speed, then stops at the end', () => {
    const { synth, player } = play({ speed: 0.5 });
    run(synth, player, 12);
    expect(synth.calls.map((c) => [c.midi, c.at, c.velocity])).toEqual([
      [36, 1, 80],
      [43, 5, 80], // beat 4 = 2 s at full speed, 4 s at half
    ]);
    expect(player.playing).toBe(false);
  });

  it('loops the range, with a bar of count-in clicks first', () => {
    const { synth, player } = play({ endBeat: 4, loop: true, countIn: true });
    run(synth, player, 6);
    expect(synth.ticks.slice(0, 4).map((t) => [t.at, t.accent])).toEqual([
      [1, true],
      [1.5, false],
      [2, false],
      [2.5, false],
    ]);
    // The loop starts at 3 s; bar 1 (2 s long) comes round again at 5 s.
    expect(synth.calls.filter((c) => c.midi === 36).map((c) => c.at)).toEqual([3, 5]);
    expect(player.beatAt(2)).toBeNull();
    expect(player.beatAt(4)).toBe(2);
    expect(player.beatAt(5.5)).toBe(1);
  });
});
