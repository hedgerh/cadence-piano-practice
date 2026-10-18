// Jam's live state (decisions.md 2026-10-18 "Jam"): the transport pumped every 25 ms, the beat
// the screen follows (requestAnimationFrame), and recording / playing back takes.
import type { JamChart } from '@cadence/content';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SynthContext } from '../../audio/useAudio';
import { useMidiEvents } from '../../midi/hooks';
import { beatSec, loopBeats, type JamSettings } from './jamTiming';
import { JamTransport } from './JamTransport';
import { TakeRecorder, keepTake, type Take, type TakeInfo } from './recorder';

const PUMP_MS = 25;
/** Take playback starts this long after the click, so its first notes are never late. */
const PLAYBACK_DELAY = 0.15;

export type RecordPhase =
  | { phase: 'idle' }
  | { phase: 'armed'; loops: number }
  | { phase: 'recording'; loops: number; startLoop: number; startAt: number; endAt: number }
  | { phase: 'playing-take'; takeId: number };

export interface JamApi {
  playing: boolean;
  /** The beat sounding now: negative in the count-in, null when stopped. */
  beat: number | null;
  start: () => void;
  stop: () => void;
  /** The chart is about to change: start the loop over once it has (no count-in). */
  requestRestart: () => void;
  record: (loops: number, info: Omit<TakeInfo, 'loops'>) => void;
  recordPhase: RecordPhase;
  takes: Take[];
  /** Play a take over its own chart and tempo. */
  playTake: (take: Take, chart: JamChart, settings: JamSettings) => void;
  deleteTake: (id: number) => void;
}

export function useJam(chart: JamChart, settings: JamSettings): JamApi {
  const synth = useContext(SynthContext);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);
  const [recordPhase, setRecordPhase] = useState<RecordPhase>({ phase: 'idle' });
  const [takes, setTakes] = useState<Take[]>([]);
  const recorder = useRef<TakeRecorder | null>(null);
  const armed = useRef<{ loops: number; info: TakeInfo } | null>(null);
  /** synth time − performance time (seconds), for MIDI event timestamps. */
  const clockOffset = useRef(0);
  const nextTakeId = useRef(1);
  const restartPending = useRef(false);

  const [transport] = useState(() => new JamTransport(synth));

  const finishTake = useCallback(() => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    const take = r.finish(nextTakeId.current++);
    setTakes((t) => keepTake(t, take));
    setRecordPhase({ phase: 'idle' });
  }, []);

  // An armed take starts on the next loop's first beat; a bounded run ends playback.
  useEffect(() => {
    transport.setHooks({
      onLoopStart: (loop, at) => {
        const a = armed.current;
        if (!a || !transport.chart) return;
        armed.current = null;
        const length = a.loops * loopBeats(transport.chart) * beatSec(transport.bpm);
        recorder.current = new TakeRecorder(at, length, a.info);
        setRecordPhase({
          phase: 'recording',
          loops: a.loops,
          startLoop: loop,
          startAt: at,
          endAt: at + length,
        });
      },
      onEnd: () => {
        setPlaying(false);
        setRecordPhase({ phase: 'idle' });
      },
    });
  }, [transport]);

  // The chart and settings, applied from the next beat; a requested restart starts the loop over.
  useEffect(() => {
    transport.update(chart, settings);
    if (!restartPending.current) return;
    restartPending.current = false;
    if (transport.playing) {
      if (recorder.current) finishTake();
      armed.current = null;
      transport.stop();
      transport.start({ countIn: false });
    }
  }, [transport, chart, settings, finishTake]);

  // Pump the scheduler while playing; finish a take once its last loop has passed.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      transport.pump();
      const r = recorder.current;
      if (r && synth.now() >= r.endAt) finishTake();
    }, PUMP_MS);
    return () => clearInterval(id);
  }, [playing, transport, synth, finishTake]);

  // Follow the beat for the screen.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const frame = () => {
      setBeat(transport.beatAt(synth.now()));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, transport, synth]);

  useMidiEvents((e) => {
    recorder.current?.add({
      type: e.type,
      midi: e.midi,
      velocity: e.velocity,
      at: e.at / 1000 + clockOffset.current,
    });
  });

  const start = useCallback(() => {
    void synth.unlock().then(() => {
      transport.start({ countIn: true });
      setPlaying(true);
    });
  }, [synth, transport]);

  const stop = useCallback(() => {
    if (recorder.current) finishTake();
    armed.current = null;
    transport.stop();
    setPlaying(false);
    setRecordPhase({ phase: 'idle' });
  }, [transport, finishTake]);

  const requestRestart = useCallback(() => {
    restartPending.current = true;
  }, []);

  const record = useCallback(
    (loops: number, info: Omit<TakeInfo, 'loops'>) => {
      clockOffset.current = synth.now() - performance.now() / 1000;
      armed.current = { loops, info: { ...info, loops } };
      setRecordPhase({ phase: 'armed', loops });
      if (!transport.playing) start();
    },
    [synth, transport, start],
  );

  const playTake = useCallback(
    (take: Take, takeChart: JamChart, takeSettings: JamSettings) => {
      armed.current = null;
      recorder.current = null;
      restartPending.current = false;
      transport.stop();
      transport.update(takeChart, takeSettings);
      void synth.unlock().then(() => {
        const t0 = synth.now() + PLAYBACK_DELAY;
        transport.start({ countIn: false, loops: take.loops, at: t0 });
        for (const n of take.notes) synth.playMidi([n.midi], t0 + n.start, n.dur, n.velocity);
        setPlaying(true);
        setRecordPhase({ phase: 'playing-take', takeId: take.id });
      });
    },
    [synth, transport],
  );

  const deleteTake = useCallback((id: number) => {
    setTakes((t) => t.filter((x) => x.id !== id));
  }, []);

  useEffect(() => () => transport.stop(), [transport]);

  return {
    playing,
    beat: playing ? beat : null,
    start,
    stop,
    requestRestart,
    record,
    recordPhase,
    takes,
    playTake,
    deleteTake,
  };
}
