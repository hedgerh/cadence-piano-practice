// decisions.md 2026-10-07 "Piano voice": bundled Salamander samples, nearest-sample lookup.
import { describe, expect, it } from 'vitest';
import {
  dataUrlToArrayBuffer,
  LOUDNESS_WINDOW_S,
  MAX_GAIN,
  loadPianoSamples,
  measureLoudness,
  normalizingGain,
  recommendedGains,
  PEAK_CEILING,
  nearestSample,
  PIANO_FILES,
  sampleMidi,
} from './pianoSamples';

describe('piano samples', () => {
  it('bundles C2..C6, one every minor third (17 files)', () => {
    const midis = Object.keys(PIANO_FILES)
      .map(sampleMidi)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(midis).toEqual(Array.from({ length: 17 }, (_, i) => 36 + 3 * i));
  });

  it('sampleMidi reads the Tone.js names ("s" = sharp)', () => {
    expect(sampleMidi('./piano/C4.mp3')).toBe(60);
    expect(sampleMidi('./piano/Ds2.mp3')).toBe(39);
    expect(sampleMidi('./piano/Fs5.mp3')).toBe(78);
    expect(sampleMidi('./piano/readme.txt')).toBeNull();
  });

  it('nearestSample: closest, ties to the lower sample; never more than 1.5 semitones away', () => {
    const sampled = [57, 60, 63];
    expect(nearestSample(60, sampled)).toBe(60);
    expect(nearestSample(61, sampled)).toBe(60);
    expect(nearestSample(62, sampled)).toBe(63);
    expect(nearestSample(40, sampled)).toBe(57);
    expect(nearestSample(60, [])).toBeNull();
  });

  it('dataUrlToArrayBuffer decodes the base64 payload', () => {
    const bytes = new Uint8Array(dataUrlToArrayBuffer('data:audio/mpeg;base64,SUQz'));
    expect([...bytes]).toEqual([0x49, 0x44, 0x33]); // "ID3"
  });

  it('loadPianoSamples decodes each file and skips one that fails', async () => {
    const decoded: number[] = [];
    const ctx = {
      decodeAudioData: (buf: ArrayBuffer) => {
        const first = new Uint8Array(buf)[0] ?? 0;
        if (first === 0xff) return Promise.reject(new Error('bad'));
        decoded.push(first);
        return Promise.resolve({ first } as unknown as AudioBuffer);
      },
    } as unknown as BaseAudioContext;
    const bank = await loadPianoSamples(ctx, {
      './piano/C4.mp3': () => Promise.resolve('data:audio/mpeg;base64,AQ=='),
      './piano/A4.mp3': () => Promise.resolve('data:audio/mpeg;base64,/w=='),
      './piano/notes.txt': () => Promise.resolve('data:,x'),
    });
    expect([...bank.keys()]).toEqual([60]);
    expect(decoded).toEqual([1]);
  });

  // decisions.md 2026-10-12 "Sample loudness".
  describe('loudness normalisation', () => {
    const SR = 1000;
    /** A mono buffer: `silence` zero samples, then a square wave of amplitude `amp`. */
    function buffer(amp: number, silence = 0, length = 2 * SR): AudioBuffer {
      const data = new Float32Array(length);
      for (let i = silence; i < length; i++) data[i] = i % 2 === 0 ? amp : -amp;
      return {
        numberOfChannels: 1,
        sampleRate: SR,
        getChannelData: () => data,
      } as unknown as AudioBuffer;
    }

    it('measures each channel over the window after the onset, ignoring leading silence', () => {
      const l = measureLoudness(buffer(0.2, 300));
      expect(l.rms[0]).toBeCloseTo(0.2, 6);
      expect(l.peak[0]).toBeCloseTo(0.2, 6);
      expect(LOUDNESS_WINDOW_S).toBe(0.5);
      expect(measureLoudness(buffer(0))).toEqual({ rms: [0], peak: [0] });
    });

    it('gain reaches the target unless that would push the peak past the ceiling', () => {
      expect(normalizingGain(0.05, 0.1, 0.1)).toBeCloseTo(2, 9);
      expect(normalizingGain(0.05, 0.6, 0.1)).toBeCloseTo(PEAK_CEILING / 0.6, 9);
      expect(normalizingGain(0, 0, 0.1)).toBe(1);
      expect(normalizingGain(0.01, 0.02, 0.1)).toBe(MAX_GAIN);
    });

    it('recommends per-channel gains: same level everywhere, left = right, audio untouched', () => {
      const square = (amp: number) =>
        new Float32Array(2 * SR).map((_, i) => (i % 2 === 0 ? amp : -amp));
      const stereo = (l: number, r: number) => {
        const ch = [square(l), square(r)];
        return {
          numberOfChannels: 2,
          sampleRate: SR,
          getChannelData: (c: number) => ch[c],
        } as unknown as AudioBuffer;
      };
      const panned = stereo(0.1, 0.2); // leaning right (like D♯5)
      const bank = new Map([
        [60, stereo(0.2, 0.2)],
        [63, panned],
        [66, stereo(0.2, 0.2)],
      ]);
      const gains = recommendedGains(bank);
      expect(gains.get(63)?.[0]).toBeCloseTo(2, 6);
      expect(gains.get(63)?.[1]).toBeCloseTo(1, 6);
      expect(gains.get(60)).toHaveLength(2);
      expect(measureLoudness(panned).rms[0]).toBeCloseTo(0.1, 6);
    });
  });
});
