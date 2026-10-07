// The piano voice's samples: Salamander Grand Piano (Alexander Holm, CC-BY 3.0), one note every
// minor third from C2 to C6 (see piano/README.md). Each MP3 is a lazily loaded JS chunk holding a
// base64 data URL (Vite `?inline`): the packaged app runs from file://, where fetch() fails, and
// the CSP blocks fetching data: URLs, so the base64 is decoded here instead.
import { type Midi, isNote, noteToMidi } from '@cadence/music';

type Loaders = Record<string, () => Promise<string>>;

export const PIANO_FILES: Loaders = import.meta.glob<string>('./piano/*.mp3', {
  query: '?inline',
  import: 'default',
});

/** "./piano/Ds4.mp3" → 63 (the Tone.js file names spell sharps as "s"). */
export function sampleMidi(path: string): Midi | null {
  const m = /([A-G])(s?)(\d)\.mp3$/.exec(path);
  if (!m) return null;
  const [, letter = '', sharp = '', octave = ''] = m;
  const note = `${letter}${sharp ? '#' : ''}${octave}`;
  return isNote(note) ? noteToMidi(note) : null;
}

/** The sampled note closest to `midi` (ties go to the lower sample: pitching up sounds cleaner). */
export function nearestSample(midi: Midi, sampled: readonly Midi[]): Midi | null {
  let best: Midi | null = null;
  for (const s of sampled) {
    if (best === null) best = s;
    else {
      const d = Math.abs(s - midi);
      const bd = Math.abs(best - midi);
      if (d < bd || (d === bd && s < best)) best = s;
    }
  }
  return best;
}

/** "data:audio/mpeg;base64,…" → the file bytes. */
export function dataUrlToArrayBuffer(url: string): ArrayBuffer {
  const base64 = url.slice(url.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export type SampleBank = ReadonlyMap<Midi, AudioBuffer>;
export type SampleLoader = (ctx: BaseAudioContext) => Promise<SampleBank>;

/** Decode every bundled sample; a file that fails to decode is left out. */
export async function loadPianoSamples(
  ctx: BaseAudioContext,
  files: Loaders = PIANO_FILES,
): Promise<SampleBank> {
  const bank = new Map<Midi, AudioBuffer>();
  await Promise.all(
    Object.entries(files).map(async ([path, load]) => {
      const midi = sampleMidi(path);
      if (midi === null) return;
      try {
        bank.set(midi, await ctx.decodeAudioData(dataUrlToArrayBuffer(await load())));
      } catch {
        // Skip it: the nearest other sample covers this range, pitched a little further.
      }
    }),
  );
  return bank;
}
