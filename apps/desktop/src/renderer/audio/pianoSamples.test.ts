// decisions.md 2026-10-07 "Piano voice": bundled Salamander samples, nearest-sample lookup.
import { describe, expect, it } from 'vitest';
import {
  dataUrlToArrayBuffer,
  loadPianoSamples,
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
});
