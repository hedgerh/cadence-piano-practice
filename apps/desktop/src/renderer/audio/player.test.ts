import { cadenceVoicing } from '@cadence/music';
import { describe, expect, it } from 'vitest';
import { NullSynth } from './NullSynth';
import { CHORD_DUR, scheduleSound, soundDuration } from './player';

// docs/engine.md §7 — schedules relative to t0 = currentTime + 0.05.
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

// decisions.md 2026-10-18 "Name the progression".
describe('chords sound', () => {
  it('one chord per gap, each letting go before the next; the last rings', () => {
    const groups = scheduleSound({
      type: 'chords',
      chords: [
        ['C4', 'E4', 'G4'],
        ['B3', 'D4', 'G4'],
      ],
      gapMs: 900,
    });
    expect(groups.map((g) => [g.notes, g.at])).toEqual([
      [[60, 64, 67], 0],
      [[59, 62, 67], 0.9],
    ]);
    expect(groups[0]?.dur).toBeCloseTo(0.85);
    expect(groups[1]?.dur).toBe(CHORD_DUR);
  });
});

describe('player → NullSynth (engine.md §7)', () => {
  it('notes: one per gapMs, 0.7 s each, last 0.9 s (EarInterval:199–200)', async () => {
    const synth = new NullSynth();
    synth.time = 10;
    await synth.play({ type: 'notes', notes: ['C4', 'F4'], gapMs: 800 });
    expect(synth.calls).toHaveLength(2);
    const [first, second] = synth.calls;
    expect(first?.midi).toBe(60);
    close(first?.at ?? NaN, 10.05);
    close(first?.dur ?? NaN, 0.7);
    expect(second?.midi).toBe(65);
    close(second?.at ?? NaN, 10.85);
    close(second?.dur ?? NaN, 0.9);
  });

  it('notes: a single prompt note rings 0.9 s', async () => {
    const synth = new NullSynth();
    await synth.play({ type: 'notes', notes: ['E4'], gapMs: 600 });
    expect(synth.calls).toEqual([{ midi: 64, at: 0.05, dur: 0.9 }]);
  });

  it('chord: all notes together for 1.2 s', async () => {
    const synth = new NullSynth();
    await synth.play({ type: 'chord', notes: ['C4', 'E4', 'G4'] });
    expect(synth.calls.map((c) => c.midi)).toEqual([60, 64, 67]);
    for (const c of synth.calls) {
      close(c.at, 0.05);
      close(c.dur, 1.2);
    }
  });

  it('cadence: cadenceVoicing(key), four chords 0.65 s apart, ~3 s', async () => {
    const synth = new NullSynth();
    await synth.play({ type: 'cadence', key: 'G', mode: 'major' });
    const chords = cadenceVoicing({ tonic: 'G', mode: 'major' });
    expect(synth.calls.map((c) => c.midi)).toEqual(chords.flat());
    const starts = [...new Set(synth.calls.map((c) => c.at.toFixed(6)))].map(Number);
    expect(starts).toHaveLength(4);
    starts.forEach((s, i) => close(s, 0.05 + i * 0.65));
    const total = soundDuration({ type: 'cadence', key: 'G', mode: 'major' });
    expect(total).toBeGreaterThan(2.5);
    expect(total).toBeLessThan(3.5);
  });

  it('phrase: eight notes 0.5 s apart, ~4 s', async () => {
    const synth = new NullSynth();
    const notes = ['E4', 'G4', 'F#4', 'E4', 'B3', 'D#4', 'F#4', 'E4'] as const;
    await synth.play({ type: 'phrase', notes: [...notes] });
    expect(synth.calls).toHaveLength(8);
    synth.calls.forEach((c, i) => {
      close(c.at, 0.05 + i * 0.5);
      close(c.dur, 0.5);
    });
    expect(synth.calls.map((c) => c.midi)).toEqual([64, 67, 66, 64, 59, 63, 66, 64]);
    close(soundDuration({ type: 'phrase', notes: [...notes] }), 4);
  });

  it('records the sounds it was given', async () => {
    const synth = new NullSynth();
    await synth.play({ type: 'chord', notes: ['A3', 'C#4', 'E4'] });
    expect(synth.sounds).toEqual([{ type: 'chord', notes: ['A3', 'C#4', 'E4'] }]);
  });
});
