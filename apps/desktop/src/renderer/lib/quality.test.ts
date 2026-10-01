import { describe, expect, it } from 'vitest';
import { qualityColor } from './quality';

describe('qualityColor', () => {
  it('maps major → tangerine, minor → teal, diminished → lavender (ui.md §1)', () => {
    expect(qualityColor('major')).toBe('var(--tangerine)');
    expect(qualityColor('minor')).toBe('var(--teal)');
    expect(qualityColor('diminished')).toBe('var(--lavender)');
  });
});
