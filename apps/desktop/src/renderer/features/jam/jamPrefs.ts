// Jam's last-used settings (decisions.md 2026-10-18 "Jam"): a per-computer convenience in
// localStorage; anything missing or malformed falls back to the defaults.
import { JAM_PRESETS, jamTonics } from '@cadence/content';
import type { PitchClass } from '@cadence/music';
import { MAX_BPM, MIN_BPM, type CompStyle } from './jamTiming';

export const PREFS_KEY = 'cadence.jam.v1';
export const LOOP_CHOICES = [1, 2, 4] as const;
export type LoopChoice = (typeof LOOP_CHOICES)[number];

export interface JamPrefs {
  presetId: string;
  tonic: PitchClass;
  bpm: number;
  comp: CompStyle;
  click: boolean;
  showChord: boolean;
  showScale: boolean;
  loops: LoopChoice;
}

export const DEFAULT_PREFS: JamPrefs = {
  presetId: 'four-chord-pop',
  tonic: 'C',
  bpm: 80,
  comp: 'held',
  click: true,
  showChord: true,
  showScale: true,
  loops: 2,
};

/** A preset's tonic, or its first when the tonic isn't one of its keys (a mode change). */
export function tonicFor(presetId: string, tonic: string): PitchClass {
  const preset = JAM_PRESETS.find((p) => p.id === presetId) ?? JAM_PRESETS[0];
  const tonics = preset ? jamTonics(preset) : [];
  return tonics.find((t) => t === tonic) ?? tonics[0] ?? 'C';
}

export function parsePrefs(raw: string | null): JamPrefs {
  if (raw === null) return DEFAULT_PREFS;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof JamPrefs, unknown>>;
    const presetId =
      typeof v.presetId === 'string' && JAM_PRESETS.some((p) => p.id === v.presetId)
        ? v.presetId
        : DEFAULT_PREFS.presetId;
    const bpm =
      typeof v.bpm === 'number' && Number.isFinite(v.bpm)
        ? Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v.bpm)))
        : DEFAULT_PREFS.bpm;
    const bool = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
    return {
      presetId,
      tonic: tonicFor(presetId, typeof v.tonic === 'string' ? v.tonic : DEFAULT_PREFS.tonic),
      bpm,
      comp: v.comp === 'pulse' ? 'pulse' : 'held',
      click: bool(v.click, DEFAULT_PREFS.click),
      showChord: bool(v.showChord, DEFAULT_PREFS.showChord),
      showScale: bool(v.showScale, DEFAULT_PREFS.showScale),
      loops: LOOP_CHOICES.find((n) => n === v.loops) ?? DEFAULT_PREFS.loops,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function loadPrefs(): JamPrefs {
  try {
    return parsePrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: JamPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable: settings last for this visit only.
  }
}
