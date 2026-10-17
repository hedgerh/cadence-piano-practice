// Helpers shared by the circle-of-keys generators (voice leading, melody).
import { type Key, type Triad, keySignatureText, keySlug, keyTitle } from '@cadence/music';
import type { Level } from '../types';

/** The triad on `degree` (0 = I) of `triads`. */
export function triadAt(triads: readonly Triad[], degree: number): Triad {
  const t = triads[degree];
  if (t === undefined) throw new RangeError(`no triad on degree ${degree + 1}`);
  return t;
}

/** Id `${keySlug}-${suffix}`, the key's title, and its signature before `blurb`. */
export function levelBase(key: Key, suffix: string, blurb: string): Omit<Level, 'steps'> {
  return {
    id: `${keySlug(key)}-${suffix}`,
    title: keyTitle(key),
    key: { tonic: key.tonic, mode: key.mode },
    blurb: `${keySignatureText(key).replace(/, /g, ' · ')} ${blurb}`,
  };
}
