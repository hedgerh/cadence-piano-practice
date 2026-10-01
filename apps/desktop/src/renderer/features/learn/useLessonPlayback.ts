// "Hear both patterns" (docs/ui.md §3 `/tracks/:trackId/lesson`): the lesson's sounds play one
// after another, HEAR_SPACING seconds apart, on the synth clock; UI timers mark the sounding
// chip and keep the button disabled until the last sound has rung out.
import type { Sound } from '@cadence/content';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LEAD_IN, scheduleSound, soundDuration } from '../../audio/player';
import type { Synth } from '../../audio/Synth';
import { SynthContext } from '../../audio/useAudio';

/** Seconds between the starts of consecutive sounds. */
export const HEAR_SPACING = 0.55;

export interface SequenceTimeline {
  /** Seconds from the click until each sound starts (lead-in included). */
  starts: number[];
  /** Seconds from the click until the last sound has finished. */
  end: number;
}

export function sequenceTimeline(
  sounds: readonly Sound[],
  spacing: number = HEAR_SPACING,
): SequenceTimeline {
  const starts = sounds.map((_, i) => LEAD_IN + i * spacing);
  const end = sounds.reduce((e, s, i) => Math.max(e, (starts[i] ?? 0) + soundDuration(s)), 0);
  return { starts, end };
}

/** Schedule every sound `spacing` seconds apart from synth time `t0`. */
export function scheduleSequence(
  synth: Pick<Synth, 'playMidi'>,
  sounds: readonly Sound[],
  t0: number,
  spacing: number = HEAR_SPACING,
): void {
  sounds.forEach((sound, i) => {
    for (const g of scheduleSound(sound)) synth.playMidi(g.notes, t0 + i * spacing + g.at, g.dur);
  });
}

export interface LessonPlayback {
  /** Index of the sound currently sounding (chip order), or null. */
  sounding: number | null;
  playing: boolean;
  play: () => void;
  stop: () => void;
}

export function useLessonPlayback(sounds: readonly Sound[]): LessonPlayback {
  const synth = useContext(SynthContext);
  const [sounding, setSounding] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const run = useRef({ cancelled: false });

  const clear = useCallback(() => {
    run.current.cancelled = true;
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  const stop = useCallback(() => {
    clear();
    synth.stop();
    setSounding(null);
    setPlaying(false);
  }, [clear, synth]);

  // Leaving the lesson silences it.
  useEffect(
    () => () => {
      clear();
      synth.stop();
    },
    [clear, synth],
  );

  const play = useCallback(() => {
    if (playing || sounds.length === 0) return;
    clear();
    const current = { cancelled: false };
    run.current = current;
    setPlaying(true);
    const { starts, end } = sequenceTimeline(sounds);
    // Audio waits for the context to resume (first gesture); the UI timeline does not.
    synth
      .unlock()
      .then(() => {
        if (!current.cancelled) scheduleSequence(synth, sounds, synth.now() + LEAD_IN);
      })
      .catch(() => undefined);
    starts.forEach((s, i) => {
      timers.current.push(setTimeout(() => setSounding(i), s * 1000));
    });
    timers.current.push(
      setTimeout(() => {
        setSounding(null);
        setPlaying(false);
      }, end * 1000),
    );
  }, [playing, sounds, synth, clear]);

  return { sounding, playing, play, stop };
}
