// decisions.md 2026-10-11 "Sound setting": the synthesized piano's tone, pinned without audio.
import { midiToFrequency } from '@cadence/music';
import { describe, expect, it } from 'vitest';
import {
  MAX_PARTIAL_HZ,
  NOTE_PEAK,
  PARTIALS,
  UNISON,
  partialFrequency,
  partialWeight,
  planNote,
  ringTimeConstant,
} from './pianoSynth';

describe('synth piano parameters', () => {
  it('partials are stretched slightly sharp of whole multiples (string stiffness)', () => {
    const f0 = midiToFrequency(60);
    expect(partialFrequency(f0, 1)).toBeCloseTo(f0 * Math.sqrt(1.0004), 6);
    const ratio = partialFrequency(f0, 8) / (8 * f0);
    expect(ratio).toBeGreaterThan(1.01);
    expect(ratio).toBeLessThan(1.02);
  });

  it('the hammer at 1/7 of the string leaves the 7th partial almost silent', () => {
    expect(partialWeight(7)).toBeLessThan(1e-9);
    expect(partialWeight(1)).toBeGreaterThan(partialWeight(2));
  });

  it('rings ~3.2 s at C3, half that two octaves up; higher partials die sooner', () => {
    expect(ringTimeConstant(48, 1)).toBeCloseTo(3.2, 6);
    expect(ringTimeConstant(72, 1)).toBeCloseTo(1.6, 6);
    expect(ringTimeConstant(48, 5)).toBeLessThan(ringTimeConstant(48, 2));
  });

  it('a note: unison partials doubled, gains sum to NOTE_PEAK', () => {
    const plan = planNote(60);
    expect(plan).toHaveLength(PARTIALS + UNISON);
    const total = plan.reduce((s, p) => s + p.gain, 0);
    expect(total).toBeCloseTo(NOTE_PEAK, 9);
    const [a, b] = plan;
    expect(a && b && a.freq / b.freq).toBeCloseTo(2 ** (1.2 / 1200), 9);
  });

  it('drops partials above MAX_PARTIAL_HZ for high notes', () => {
    const plan = planNote(96); // C7: 2093 Hz → only partials below 16 kHz
    expect(plan.every((p) => p.freq < MAX_PARTIAL_HZ)).toBe(true);
    expect(plan.length).toBeLessThan(PARTIALS + UNISON);
  });
});
