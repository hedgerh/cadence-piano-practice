// A practice step's sound. Progression steps: "Hear it" plays the voice-led path the hints
// follow, chord after chord on the synth clock (decisions.md 2026-10-10 "Voice leading").
// Other steps (decisions.md 2026-10-17 "Melody tracks"): a `play` sound is the prompt — it
// plays by itself when the step comes up and "Play it again" repeats it (Melody echo); a
// `hint` sound is a demonstration on request ("Hear it", arpeggios). Neither shows keys.
import type { Sound } from '@cadence/content';
import { progressionPath, type MatchSpec, type Midi } from '@cadence/music';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LEAD_IN } from '../../audio/player';
import { SynthContext } from '../../audio/useAudio';
import type { PracticeStep } from './practiceReducer';

/** Seconds between chord starts, and how long each rings. */
export const PROGRESSION_SPACING = 0.9;
export const PROGRESSION_CHORD_DUR = 0.85;
/** engine.md §5: a prompt plays itself after a short pause, as in the ear drills. */
export const AUTO_PLAY_MS = 300;

export type StepSound =
  { kind: 'chords'; chords: Midi[][] } | { kind: 'sound'; sound: Sound; prompt: boolean };

/** The chords "Hear it" plays for `match`, or [] when it is not a progression. */
export function progressionChords(match: MatchSpec | undefined): Midi[][] {
  return match?.type === 'progression' ? progressionPath(match) : [];
}

/** What a step can play: a progression's path, its `play` prompt, or its `hint` demo. */
export function stepSound(
  step: Pick<PracticeStep, 'match' | 'play' | 'hint'> | undefined,
): StepSound | null {
  if (!step) return null;
  const chords = progressionChords(step.match);
  if (chords.length > 0) return { kind: 'chords', chords };
  if (step.play) return { kind: 'sound', sound: step.play, prompt: true };
  if (step.hint) return { kind: 'sound', sound: step.hint, prompt: false };
  return null;
}

/** "Play it again" for a prompt, "Hear it" for a demonstration. */
export function stepSoundLabel(sound: StepSound | null): string {
  return sound?.kind === 'sound' && sound.prompt ? 'Play it again' : 'Hear it';
}

/**
 * `autoKey` names the current visit to the step (null while not listening): when it changes
 * and the step has a prompt, the prompt plays after AUTO_PLAY_MS.
 */
export function useStepSound(
  step: Pick<PracticeStep, 'match' | 'play' | 'hint'> | undefined,
  autoKey: string | null,
): { available: boolean; playing: boolean; play: () => void; label: string } {
  const synth = useContext(SynthContext);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sound = useMemo(() => stepSound(step), [step]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const play = useCallback(() => {
    if (!sound) return;
    if (sound.kind === 'chords') {
      if (playing) return;
      setPlaying(true);
      synth
        .unlock()
        .then(() => {
          const t0 = synth.now() + LEAD_IN;
          sound.chords.forEach((notes, i) => {
            synth.playMidi(notes, t0 + i * PROGRESSION_SPACING, PROGRESSION_CHORD_DUR);
          });
        })
        .catch(() => undefined);
      const end = LEAD_IN + (sound.chords.length - 1) * PROGRESSION_SPACING + PROGRESSION_CHORD_DUR;
      timer.current = setTimeout(() => setPlaying(false), end * 1000);
      return;
    }
    // A prompt or demo starts over from the top; live notes are never cut (Play my notes).
    synth.stop();
    setPlaying(true);
    void synth
      .play(sound.sound)
      .catch(() => undefined)
      .finally(() => setPlaying(false));
  }, [sound, playing, synth]);

  // The prompt plays itself once per visit.
  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  });
  const prompt = sound?.kind === 'sound' && sound.prompt;
  useEffect(() => {
    if (autoKey === null || !prompt) return;
    const t = setTimeout(() => playRef.current(), AUTO_PLAY_MS);
    return () => clearTimeout(t);
  }, [autoKey, prompt]);

  return { available: sound !== null, playing, play, label: stepSoundLabel(sound) };
}
