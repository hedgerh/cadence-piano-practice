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
  };
  return { ctx, log, compressor };
}

describe('WebAudioSynth', () => {
  it('master gain → compressor (−12 dB, ratio 4) → destination', () => {
    const { ctx, log, compressor } = fakeContext();
    const synth = new WebAudioSynth(() => ctx as unknown as AudioContext);
    synth.now();
    expect(compressor.threshold.value).toBe(-12);
    expect(compressor.ratio.value).toBe(4);
    expect(log).toContainEqual(['gain.connect', 'compressor']);
    expect(log).toContainEqual(['compressor.connect', 'destination']);
  });

  it('voice: triangle, 0.0001 → 0.25 in 20 ms → 0.0001 at dur, stop at dur + 0.05', () => {
    const { ctx, log } = fakeContext();
    const synth = new WebAudioSynth(() => ctx as unknown as AudioContext);
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
});
