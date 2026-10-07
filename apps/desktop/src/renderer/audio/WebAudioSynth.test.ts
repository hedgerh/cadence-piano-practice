import { describe, expect, it } from 'vitest';
import { WebAudioSynth } from './WebAudioSynth';

// docs/engine.md §7 — exact envelope and master chain, checked against a recording fake.
type Call = [string, ...unknown[]];

function fakeContext() {
  const log: Call[] = [];
  const param = (name: string) => ({
    value: 0,
    setValueAtTime: (v: number, t: number) => log.push([`${name}.set`, v, t]),
    exponentialRampToValueAtTime: (v: number, t: number) => log.push([`${name}.exp`, v, t]),
  });
  const node = (kind: string) => ({
    connect: (to: { kind?: string }) => log.push([`${kind}.connect`, to.kind]),
    disconnect: () => undefined,
    kind,
  });
  const compressor = {
    ...node('compressor'),
    threshold: param('threshold'),
    ratio: param('ratio'),
  };
  const ctx = {
    currentTime: 2,
    state: 'running',
    destination: { kind: 'destination' },
    resume: () => Promise.resolve(),
    createGain: () => ({ ...node('gain'), gain: param('gain') }),
    createDynamicsCompressor: () => compressor,
    createOscillator: () => ({
      ...node('osc'),
      type: '',
      frequency: { value: 0 },
      onended: null,
      start: (t: number) => log.push(['osc.start', t]),
      stop: (t: number) => log.push(['osc.stop', t]),
    }),
    createBufferSource: () => {
      const src = {
        ...node('src'),
        buffer: null as unknown,
        playbackRate: { value: 1 },
        onended: null,
        start: (t: number) => log.push(['src.start', t, src.buffer, src.playbackRate.value]),
        stop: (t: number) => log.push(['src.stop', t]),
      };
      return src;
    },
  };
  return { ctx, log, compressor };
}

/** No samples: the oscillator voice. */
const noSamples = () => Promise.resolve(new Map<number, AudioBuffer>());

describe('WebAudioSynth', () => {
  it('master gain → compressor (−12 dB, ratio 4) → destination', () => {
    const { ctx, log, compressor } = fakeContext();
    const synth = new WebAudioSynth(() => ctx as unknown as AudioContext, noSamples);
    synth.now();
    expect(compressor.threshold.value).toBe(-12);
    expect(compressor.ratio.value).toBe(4);
    expect(log).toContainEqual(['gain.connect', 'compressor']);
    expect(log).toContainEqual(['compressor.connect', 'destination']);
  });

  it('voice: triangle, 0.0001 → 0.25 in 20 ms → 0.0001 at dur, stop at dur + 0.05', () => {
    const { ctx, log } = fakeContext();
    const synth = new WebAudioSynth(() => ctx as unknown as AudioContext, noSamples);
    synth.playMidi([69], 3, 0.7);
    expect(log).toEqual(
      expect.arrayContaining([
        ['gain.set', 0.0001, 3],
        ['gain.exp', 0.25, 3.02],
        ['gain.exp', 0.0001, 3.7],
        ['osc.start', 3],
        ['osc.stop', 3.75],
      ]),
    );
    const order = log.filter(([k]) => k === 'gain.set' || k === 'gain.exp').map(([k]) => k);
    expect(order).toEqual(['gain.set', 'gain.exp', 'gain.exp']);
  });

  // decisions.md 2026-10-07 "Piano voice".
  describe('piano voice (samples decoded)', () => {
    const C4 = { name: 'C4 buffer' } as unknown as AudioBuffer;
    const Ds4 = { name: 'D#4 buffer' } as unknown as AudioBuffer;
    const bank = () =>
      Promise.resolve(
        new Map([
          [60, C4],
          [63, Ds4],
        ]),
      );

    it('unlock waits for the samples; then the nearest sample plays, pitched by playbackRate', async () => {
      const { ctx, log } = fakeContext();
      const synth = new WebAudioSynth(() => ctx as unknown as AudioContext, bank);
      await synth.unlock();
      synth.playMidi([61, 62], 3, 0.7); // C♯4 from C4 (+1), D4 from D♯4 (−1)
      const starts = log.filter(([k]) => k === 'src.start');
      expect(starts[0]).toEqual(['src.start', 3, C4, 2 ** (1 / 12)]);
      expect(starts[1]).toEqual(['src.start', 3, Ds4, 2 ** (-1 / 12)]);
      expect(log.some(([k]) => k === 'osc.start')).toBe(false);
    });

    it('held at 0.9 for dur, then damped to 0.0001 over 0.4 s; stop 0.05 s later', async () => {
      const { ctx, log } = fakeContext();
      const synth = new WebAudioSynth(() => ctx as unknown as AudioContext, bank);
      await synth.unlock();
      synth.playMidi([60], 3, 0.7);
      expect(log).toEqual(
        expect.arrayContaining([
          ['gain.set', 0.9, 3],
          ['gain.set', 0.9, 3.7],
          ['gain.exp', 0.0001, 3.7 + 0.4],
          ['src.stop', 3.7 + 0.4 + 0.05],
        ]),
      );
    });

    it('falls back to the oscillator when the samples fail to load', async () => {
      const { ctx, log } = fakeContext();
      const synth = new WebAudioSynth(
        () => ctx as unknown as AudioContext,
        () => Promise.reject(new Error('decode failed')),
      );
      await synth.unlock();
      synth.playMidi([60], 3, 0.7);
      expect(log.some(([k]) => k === 'osc.start')).toBe(true);
      expect(log.some(([k]) => k === 'src.start')).toBe(false);
    });
  });
});
