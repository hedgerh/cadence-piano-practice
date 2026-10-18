// decisions.md 2026-10-18 "Jam": beat math, what the backing plays, the look-ahead transport
// (nothing scheduled twice) and takes.
import { JAM_PRESETS, jamChart } from '@cadence/content';
import { describe, expect, it } from 'vitest';
import { NullSynth } from '../../audio/NullSynth';
import {
  BASS_VELOCITY,
  COUNT_IN_BEATS,
  backingVoicings,
  beatSec,
  eventsForBeat,
  loopBeats,
  positionOf,
  type JamSettings,
} from './jamTiming';
import { JamTransport, LOOKAHEAD, START_DELAY } from './JamTransport';
import { TakeRecorder, keepTake, MAX_TAKES, type Take } from './recorder';

const preset = (id: string) => {
  const p = JAM_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`no preset ${id}`);
  return p;
};
const blues = jamChart(preset('twelve-bar-blues'), 'A');
const pop = jamChart(preset('four-chord-pop'), 'C');
const held: JamSettings = { bpm: 120, comp: 'held', click: true };

describe('jam timing', () => {
  it('beats and loops: 12-bar blues is 48 beats', () => {
    expect(beatSec(120)).toBe(0.5);
    expect(loopBeats(blues)).toBe(48);
    expect(positionOf(blues, 0)).toMatchObject({
      chord: 0,
      bar: 0,
      beatInChord: 0,
      chordBeats: 16,
    });
    expect(positionOf(blues, 16)).toMatchObject({ chord: 1, bar: 4, beatInBar: 0 });
    expect(positionOf(blues, 33)).toMatchObject({ chord: 3, bar: 8, beatInBar: 1 });
    expect(positionOf(blues, 48 + 17)).toMatchObject({ chord: 1, loop: 1, beatInChord: 1 });
  });

  it('backing: a left-hand root in C2..B2 under a voice-led right hand', () => {
    const v = backingVoicings(pop);
    expect(v.map((x) => x[0])).toEqual([36, 43, 45, 41]);
    for (const voicing of v) expect(voicing).toHaveLength(4);
  });

  it('held: bass and chord on the chord’s first beat, ringing its length; clicks every beat', () => {
    const v = backingVoicings(pop);
    const first = eventsForBeat(pop, v, held, 0, 10);
    expect(first).toEqual([
      { kind: 'tick', at: 10, accent: true },
      { kind: 'notes', notes: [36], at: 10, dur: 4 * 0.5 * 0.95, velocity: BASS_VELOCITY },
      expect.objectContaining({ kind: 'notes', notes: v[0]?.slice(1), dur: 4 * 0.5 * 0.95 }),
    ]);
    expect(eventsForBeat(pop, v, held, 1, 10.5)).toEqual([
      { kind: 'tick', at: 10.5, accent: false },
    ]);
    expect(eventsForBeat(pop, v, { ...held, click: false }, 1, 10.5)).toEqual([]);
  });

  it('pulse: the chord strikes on every beat; the count-in is clicks only', () => {
    const v = backingVoicings(pop);
    const pulse = eventsForBeat(pop, v, { ...held, comp: 'pulse', click: false }, 2, 11);
    expect(pulse).toEqual([
      expect.objectContaining({ kind: 'notes', notes: v[0]?.slice(1), dur: 0.3 }),
    ]);
    expect(eventsForBeat(pop, v, held, -COUNT_IN_BEATS, 9)).toEqual([
      { kind: 'tick', at: 9, accent: true },
    ]);
    expect(eventsForBeat(pop, v, held, -1, 9.5)).toEqual([
      { kind: 'tick', at: 9.5, accent: false },
    ]);
  });
});

describe('JamTransport', () => {
  const setup = () => {
    const synth = new NullSynth();
    const t = new JamTransport(synth);
    t.update(pop, held);
    return { synth, t };
  };

  it('schedules each beat once as time moves on, through the count-in', () => {
    const { synth, t } = setup();
    synth.time = 5;
    t.start({ countIn: true });
    const scheduledTicks = () => synth.ticks.map((x) => x.at);
    for (let now = 5; now < 9; now += 0.025) {
      synth.time = now;
      t.pump();
    }
    const ticks = scheduledTicks();
    expect(new Set(ticks).size).toBe(ticks.length);
    expect(ticks[0]).toBeCloseTo(5 + START_DELAY);
    expect(ticks[4]).toBeCloseTo(5 + START_DELAY + 4 * 0.5); // the loop starts after one bar
    expect(Math.max(...ticks)).toBeLessThan(9 + LOOKAHEAD);
    expect(t.beatAt(5 + START_DELAY + 4 * 0.5 + 0.01)).toBe(0);
    expect(t.beatAt(5 + START_DELAY + 0.6)).toBe(-3);
  });

  it('a tempo change applies from the next beat; stop silences the backing', () => {
    const { synth, t } = setup();
    t.start({ countIn: false, at: 1 });
    synth.time = 1;
    t.pump();
    t.update(pop, { ...held, bpm: 60 });
    synth.time = 3;
    t.pump();
    const ats = synth.ticks.map((x) => x.at);
    expect(ats.slice(0, 2)).toEqual([1, 1.5]);
    expect(ats[2]).toBeCloseTo(2.5);
    t.stop();
    expect(t.playing).toBe(false);
  });

  it('a bounded run calls onLoopStart per loop and onEnd after the last', () => {
    const synth = new NullSynth();
    const loops: number[] = [];
    let ended = false;
    const t = new JamTransport(synth, {
      onLoopStart: (loop) => loops.push(loop),
      onEnd: () => {
        ended = true;
      },
    });
    t.update(pop, held);
    t.start({ countIn: false, loops: 2, at: 0 });
    for (let now = 0; now < 17; now += 0.05) {
      synth.time = now;
      t.pump();
    }
    expect(loops).toEqual([0, 1]);
    expect(ended).toBe(true);
    expect(t.playing).toBe(false);
  });
});

describe('takes', () => {
  const info = { presetId: 'four-chord-pop', tonic: 'C', bpm: 120, loops: 1 };

  it('notes are timed from the take’s first beat; held notes are cut at the end', () => {
    const r = new TakeRecorder(10, 8, info);
    r.add({ type: 'on', midi: 60, velocity: 90, at: 9.5 }); // before the take: ignored
    r.add({ type: 'on', midi: 64, velocity: 80, at: 10.25 });
    r.add({ type: 'off', midi: 64, velocity: 0, at: 10.75 });
    r.add({ type: 'on', midi: 67, velocity: 70, at: 17.5 });
    const take = r.finish(1);
    expect(take.notes).toEqual([
      { midi: 64, start: 0.25, dur: 0.5, velocity: 80 },
      { midi: 67, start: 7.5, dur: 0.5, velocity: 70 },
    ]);
    expect(take).toMatchObject({ id: 1, length: 8, bpm: 120 });
  });

  it('keeps the newest takes, at most five', () => {
    let takes: Take[] = [];
    for (let i = 1; i <= 7; i++) takes = keepTake(takes, new TakeRecorder(0, 1, info).finish(i));
    expect(takes.map((t) => t.id)).toEqual([7, 6, 5, 4, 3]);
    expect(takes).toHaveLength(MAX_TAKES);
  });
});
