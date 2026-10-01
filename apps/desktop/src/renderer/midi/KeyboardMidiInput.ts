import type { Midi } from '@cadence/music';
import { BaseMidiInput } from './MidiInput';

/**
 * Computer-keyboard fallback (docs/ui.md §4): `a w s e d f t g y h u j k o l p ;` play
 * C4…E5 (white keys on the home row, black keys on the row above); `z` / `x` shift the
 * octave down / up. Ignores auto-repeat, modifier chords and typing in form fields;
 * releases everything when the window loses focus.
 */
export const KEY_TO_SEMITONE: Readonly<Record<string, number>> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14,
  p: 15,
  ';': 16,
};

const BASE_MIDI = 60; // C4
const MIN_SHIFT = -3;
const MAX_SHIFT = 3;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export class KeyboardMidiInput extends BaseMidiInput {
  private octaveShift = 0;
  /** key → MIDI that key started, so an octave change mid-press still releases it. */
  private readonly down = new Map<string, Midi>();
  private target: Window | null = null;

  constructor(private readonly win: Window | undefined = globalThis.window) {
    super();
    this.status.set({ kind: 'connected', deviceName: 'Computer keyboard', deviceId: 'keyboard' });
  }

  start(): Promise<void> {
    if (this.target || !this.win) return Promise.resolve();
    this.target = this.win;
    this.win.addEventListener('keydown', this.onKeyDown);
    this.win.addEventListener('keyup', this.onKeyUp);
    this.win.addEventListener('blur', this.onBlur);
    return Promise.resolve();
  }

  stop(): void {
    if (this.target) {
      this.target.removeEventListener('keydown', this.onKeyDown);
      this.target.removeEventListener('keyup', this.onKeyUp);
      this.target.removeEventListener('blur', this.onBlur);
      this.target = null;
    }
    this.down.clear();
    this.releaseAll();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
    const key = e.key.toLowerCase();
    if (key === 'z' || key === 'x') {
      if (!e.repeat) {
        const delta = key === 'z' ? -1 : 1;
        this.octaveShift = Math.min(MAX_SHIFT, Math.max(MIN_SHIFT, this.octaveShift + delta));
      }
      return;
    }
    const semitone = KEY_TO_SEMITONE[key];
    if (semitone === undefined) return;
    if (e.repeat || this.down.has(key)) return;
    const midi = BASE_MIDI + this.octaveShift * 12 + semitone;
    this.down.set(key, midi);
    this.noteOn(midi, 96);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    const midi = this.down.get(key);
    if (midi === undefined) return;
    this.down.delete(key);
    // Another key may still hold the same pitch after an octave shift.
    if ([...this.down.values()].includes(midi)) return;
    this.noteOff(midi);
  };

  private readonly onBlur = (): void => {
    this.down.clear();
    this.releaseAll();
  };
}
