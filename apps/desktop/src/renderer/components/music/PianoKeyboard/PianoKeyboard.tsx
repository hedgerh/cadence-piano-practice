import { noteToMidi, type Midi, type Note } from '@cadence/music';
import { cx } from '../../../lib/cx';
import { useHeldNotes } from '../../../midi/hooks';
import { blackKeys, whiteKeys, type KeyboardVariant } from './keyboardLayout';
import styles from './PianoKeyboard.module.css';

/**
 * `previous`: the chord just played (progressions), outlined in teal; `far`: a held key that moved
 * too far from it (decisions.md 2026-10-10 "Voice leading"). Jam guides (decisions.md
 * 2026-10-18 "Jam"): `chord` = a tone of the chord playing now, `scale` = a note of the guide
 * scale; a held key draws over both.
 */
export type KeyState =
  'idle' | 'held' | 'hint' | 'correct' | 'tried' | 'home' | 'previous' | 'far' | 'chord' | 'scale';
/** Lighting per MIDI number (enharmonic-safe; build from notes with `keyStates`). */
export type KeyStates = Readonly<Partial<Record<Midi, KeyState>>>;

/** docs/ui.md §2: correct > home/far > hint > held > tried/previous. */
const PRIORITY: Readonly<Record<KeyState, number>> = {
  idle: 0,
  tried: 1,
  previous: 1,
  scale: 1,
  chord: 1,
  held: 2,
  hint: 3,
  home: 4,
  far: 4,
  correct: 5,
};

const VARIANT_CLASS: Readonly<Record<KeyboardVariant, string | undefined>> = {
  'three-octave': styles.threeOctave,
  'two-octave': styles.twoOctave,
  'one-octave': styles.oneOctave,
};

export function resolveKeyState(explicit: KeyState | undefined, held: boolean): KeyState {
  const base = explicit ?? 'idle';
  return held && PRIORITY.held > PRIORITY[base] ? 'held' : base;
}

/** `keyStates(['A3', 'C#4', 'E4'], 'hint')` → `{ 57: 'hint', 61: 'hint', 64: 'hint' }`. */
export function keyStates(notes: readonly Note[], state: KeyState): Record<Midi, KeyState> {
  const out: Record<Midi, KeyState> = {};
  for (const n of notes) out[noteToMidi(n)] = state;
  return out;
}

export interface PianoKeyboardProps {
  /**
   * three-octave C2–B4 990px (voice leading) · two-octave C3–B4 661px (Practice:90) ·
   * one-octave 332px (EarInterval:81).
   */
  variant: KeyboardVariant;
  states?: KeyStates;
  /** Extra held notes (e.g. a fixture). */
  held?: ReadonlySet<Midi>;
  /** Also light whatever the MIDI store says is held. */
  live?: boolean;
  /** Lowest C; defaults to C3 (two-octave) / C4 (one-octave). */
  startMidi?: Midi;
  'data-testid'?: string;
}

const NO_HELD: ReadonlySet<Midi> = new Set();

export function PianoKeyboard({
  variant,
  states = {},
  held = NO_HELD,
  live = false,
  startMidi,
  'data-testid': testId,
}: PianoKeyboardProps) {
  const liveHeld = useHeldNotes();
  const isHeld = (m: Midi) => held.has(m) || (live && liveHeld.has(m));
  return (
    <div
      className={cx(styles.keyboard, VARIANT_CLASS[variant])}
      data-testid={testId}
      data-variant={variant}
      role="img"
      aria-label="Piano keyboard"
    >
      {whiteKeys(variant, startMidi).map((k) => {
        const state = resolveKeyState(states[k.midi], isHeld(k.midi));
        return (
          <span
            key={k.midi}
            className={cx(styles.white, state !== 'idle' && styles[state])}
            data-key="white"
            data-midi={k.midi}
            data-state={state}
          >
            {k.label}
          </span>
        );
      })}
      {blackKeys(variant, startMidi).map((k) => {
        const state = resolveKeyState(states[k.midi], isHeld(k.midi));
        return (
          <span
            key={k.midi}
            className={cx(styles.black, state !== 'idle' && styles[state])}
            style={{ left: k.leftPx }}
            data-key="black"
            data-midi={k.midi}
            data-state={state}
          />
        );
      })}
    </div>
  );
}
