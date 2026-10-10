// decisions.md 2026-10-12 "Sample loudness": the baked table covers every bundled sample.
import { describe, expect, it } from 'vitest';
import { PIANO_SAMPLE_GAINS, sampleGains } from './pianoGains';
import { MAX_GAIN, PIANO_FILES, sampleName } from './pianoSamples';

describe('baked piano sample gains', () => {
  it('one [left, right] pair per bundled file, each within (0, MAX_GAIN]', () => {
    const files = Object.keys(PIANO_FILES).map(sampleName).sort();
    expect(Object.keys(PIANO_SAMPLE_GAINS).sort()).toEqual(files);
    for (const pair of Object.values(PIANO_SAMPLE_GAINS)) {
      expect(pair).toHaveLength(2);
      for (const g of pair) {
        expect(g).toBeGreaterThan(0);
        expect(g).toBeLessThanOrEqual(MAX_GAIN);
      }
    }
  });

  it('looks gains up by the sample midi; unknown samples are left alone', () => {
    expect(sampleGains(63)).toEqual([1.262, 0.958]); // D♯4
    expect(sampleGains(75)).toEqual([2.5, 0.919]); // D♯5: left boost capped
    expect(sampleGains(61)).toEqual([1, 1]);
  });
});
