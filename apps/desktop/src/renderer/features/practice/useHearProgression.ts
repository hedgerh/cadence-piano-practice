// "Hear it" on a progression step (decisions.md 2026-10-10 "Voice leading"): the voice-led path
// the hints follow, chord after chord on the synth clock. Not a hint: it shows no keys.
import { progressionPath, type MatchSpec, type Midi } from '@cadence/music';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LEAD_IN } from '../../audio/player';
import { SynthContext } from '../../audio/useAudio';

/** Seconds between chord starts, and how long each rings. */
export const PROGRESSION_SPACING = 0.9;
export const PROGRESSION_CHORD_DUR = 0.85;

/** The chords "Hear it" plays for `match`, or [] when it is not a progression. */
export function progressionChords(match: MatchSpec | undefined): Midi[][] {
  return match?.type === 'progression' ? progressionPath(match) : [];
}

export function useHearProgression(match: MatchSpec | undefined): {
  available: boolean;
  playing: boolean;
  play: () => void;
} {
  const synth = useContext(SynthContext);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chords = useMemo(() => progressionChords(match), [match]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const play = useCallback(() => {
    if (playing || chords.length === 0) return;
    setPlaying(true);
    synth
      .unlock()
      .then(() => {
        const t0 = synth.now() + LEAD_IN;
        chords.forEach((notes, i) => {
          synth.playMidi(notes, t0 + i * PROGRESSION_SPACING, PROGRESSION_CHORD_DUR);
        });
      })
      .catch(() => undefined);
    const end = LEAD_IN + (chords.length - 1) * PROGRESSION_SPACING + PROGRESSION_CHORD_DUR;
    timer.current = setTimeout(() => setPlaying(false), end * 1000);
  }, [playing, chords, synth]);

  return { available: chords.length > 0, playing, play };
}
