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

/** The part of a note that is heard in practice (notes ring 0.7–1.2 s plus the damper). */
export const LOUDNESS_WINDOW_S = 0.5;
/** The note starts where any channel first reaches this share of the overall peak. */
const ONSET_SHARE = 0.05;
/** Never scale a channel so far that its peak exceeds this. */
export const PEAK_CEILING = 0.98;
/**
 * Never boost a channel more than this (+8 dB): a far-microphone channel recorded very quietly
 * (D♯5's left, −35 dB) would otherwise bring its MP3 coding noise up with it.
 */
export const MAX_GAIN = 2.5;

/** Per channel (index 0 = left, 1 = right). */
export interface Loudness {
  /** RMS over LOUDNESS_WINDOW_S from the onset. */
  rms: number[];
  peak: number[];
}

/**
 * decisions.md 2026-10-12 "Sample loudness": how loud the heard part of each channel is. The
 * channels are measured separately because the samples' stereo balance jumps between
 * neighbouring notes, and a mono mix of these spaced-microphone recordings partly cancels.
 */
export function measureLoudness(
  buffer: Pick<AudioBuffer, 'numberOfChannels' | 'sampleRate' | 'getChannelData'>,
): Loudness {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
    buffer.getChannelData(c),
  );
  const peak = channels.map((ch) => ch.reduce((m, v) => Math.max(m, Math.abs(v)), 0));
  const top = Math.max(0, ...peak);
  const length = channels[0]?.length ?? 0;
  if (top === 0) return { rms: channels.map(() => 0), peak };
  let onset = 0;
  while (onset < length && channels.every((ch) => Math.abs(ch[onset] ?? 0) < ONSET_SHARE * top)) {
    onset++;
  }
  const end = Math.min(length, onset + Math.round(buffer.sampleRate * LOUDNESS_WINDOW_S));
  const rms = channels.map((ch) => {
    let sum = 0;
    for (let i = onset; i < end; i++) sum += (ch[i] ?? 0) ** 2;
    return Math.sqrt(sum / Math.max(1, end - onset));
  });
  return { rms, peak };
}

/** Gain bringing one channel to `targetRms`, capped by PEAK_CEILING and MAX_GAIN. */
export function normalizingGain(rms: number, peak: number, targetRms: number): number {
  if (rms === 0 || peak === 0) return 1;
  return Math.min(targetRms / rms, PEAK_CEILING / peak, MAX_GAIN);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * Per-channel gains bringing every channel of every sample to the median channel loudness: the
 * same level everywhere, and left = right so the image stops jumping (decisions.md 2026-10-12
 * "Sample loudness"). A measuring tool only: the app plays the baked PIANO_SAMPLE_GAINS. Re-run
 * it with `__cadenceDev.audio.measureSamples()` if the files change.
 */
export function recommendedGains(bank: ReadonlyMap<Midi, AudioBuffer>): Map<Midi, number[]> {
  const loudness = new Map([...bank].map(([midi, buf]) => [midi, measureLoudness(buf)] as const));
  const target = median([...loudness.values()].flatMap((l) => l.rms).filter((r) => r > 0));
  return new Map(
    [...loudness].map(
      ([midi, l]) =>
        [midi, l.rms.map((r, c) => normalizingGain(r, l.peak[c] ?? 0, target))] as const,
    ),
  );
}

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

/** "./piano/Ds5.mp3" → "Ds5". */
export function sampleName(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.mp3$/, '');
}

/**
 * Decode the bundled files and return the recommended [left, right] gains per file name
 * ("Ds5": [1.9, 0.6]), rounded to 3 decimals: the numbers for PIANO_SAMPLE_GAINS. Dev tool only.
 */
export async function measureSampleGains(
  ctx: BaseAudioContext,
  files: Loaders = PIANO_FILES,
): Promise<Record<string, number[]>> {
  const bank = await loadPianoSamples(ctx, files);
  const gains = recommendedGains(bank);
  const out: Record<string, number[]> = {};
  for (const path of Object.keys(files)) {
    const midi = sampleMidi(path);
    const g = midi === null ? undefined : gains.get(midi);
    if (g !== undefined) out[sampleName(path)] = g.map((v) => Math.round(v * 1000) / 1000);
  }
  return out;
}
