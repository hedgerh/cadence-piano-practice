// decisions.md 2026-10-18 "Jam": every preset spells in every key of its mode.
import { describe, expect, it } from 'vitest';
import { JAM_PRESETS, jamChart, jamTonics } from './jam';

const preset = (id: string) => {
  const p = JAM_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`no preset ${id}`);
  return p;
};

describe('jam presets', () => {
  it('every preset spells in all 12 keys of its mode', () => {
    for (const p of JAM_PRESETS) {
      for (const tonic of jamTonics(p)) {
        const chart = jamChart(p, tonic);
        expect(chart.chords).toHaveLength(p.chords.length);
        expect(chart.scale.length).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('12-bar blues in A: A7 D7 E7 over 12 bars, with the A blues scale', () => {
    const chart = jamChart(preset('twelve-bar-blues'), 'A');
    expect(chart.bars).toBe(12);
    expect(chart.chords.map((ch) => `${ch.symbol}×${ch.bars}`)).toEqual([
      'A7×4',
      'D7×2',
      'A7×2',
      'E7×1',
      'D7×1',
      'A7×2',
    ]);
    expect(chart.scale).toEqual(['A', 'C', 'D', 'Eb', 'E', 'G']);
  });

  it('minor presets use the major V; G♯ minor plays as A♭ minor', () => {
    const andalusian = jamChart(preset('andalusian'), 'A');
    expect(andalusian.chords.map((ch) => ch.symbol)).toEqual(['Am', 'G', 'F', 'E']);
    expect(jamChart(preset('epic-minor'), 'G#').key.tonic).toBe('Ab');
  });

  it('ii–V–I uses 7th chords', () => {
    expect(jamChart(preset('two-five-one'), 'C').chords.map((ch) => ch.symbol)).toEqual([
      'Dm7',
      'G7',
      'Cmaj7',
    ]);
  });
});
