import type { Quality } from '@cadence/content';

/**
 * The single chord-quality → color mapping (docs/ui.md §1, CLAUDE.md "Design fidelity"):
 * major → tangerine, minor → teal, diminished → lavender. Returns a tokens.css variable.
 */
export function qualityColor(quality: Quality): string {
  switch (quality) {
    case 'major':
      return 'var(--tangerine)';
    case 'minor':
      return 'var(--teal)';
    case 'diminished':
      return 'var(--lavender)';
  }
}

export const QUALITY_LABEL_SHORT: Readonly<Record<Quality, string>> = {
  major: 'major',
  minor: 'minor',
  diminished: 'dim',
};

export const QUALITY_LABEL: Readonly<Record<Quality, string>> = {
  major: 'major',
  minor: 'minor',
  diminished: 'diminished',
};
