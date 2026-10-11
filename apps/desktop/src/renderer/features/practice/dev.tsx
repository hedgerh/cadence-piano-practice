// /dev/screens/practice — Practice.dc.html's default state (A major, I and ii done, iii current,
// vis all, no hint; Practice:136) driven through the real reducer, with live dev MIDI.
// Knobs: ?hint=0|1|2 &vis=num|name|all &midi=none|denied &finished=1 &auto=1 (hands-free
// auto-finish; the dev screen has no session, so it ends in the finish error)
// &level=scale (A minor scale, nothing done yet: the minor-scales track)
import { keyLevel, scaleLevel } from '@cadence/content';
import type { ComponentType } from 'react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { practiceState } from '../../dev/fixtures/practice';
import type { MidiStatus } from '../../midi/MidiInput';
import {
  initialPracticeState,
  practiceReducer,
  type PracticeSession,
  type PracticeState,
  type Visibility,
} from './practiceReducer';
import { eyebrowFor, markPlayedMode } from './practiceSelectors';
import { PracticeView } from './PracticeView';
import { usePracticeSession, type PracticeIo } from './usePracticeSession';

/**
 * A major (Practice:139–147) as a SessionDto, with `done` ordinals recorded clean; `scale`
 * swaps in the A minor scale level (steps Up / Down).
 */
export function practiceSessionFixture(opts: {
  done: readonly number[];
  vis: Visibility;
  scale?: boolean;
}): PracticeSession {
  const level = opts.scale
    ? scaleLevel({ tonic: 'A', mode: 'minor' })
    : keyLevel({ tonic: 'A', mode: 'major' });
  const steps = level.steps.map((s) => ({ ...s, lastResult: null, dueOn: null, intervalDays: 0 }));
  return {
    sessionId: 'dev-practice',
    focus: null,
    run: null,
    runProgress: null,
    trackId: opts.scale ? 'minor-scales' : 'major-diatonic-chords',
    trackTitle: opts.scale ? 'Minor scales' : 'Major diatonic chords',
    levelId: level.id,
    levelTitle: level.title,
    levelNote: level.note ?? null,
    shortTitle: level.title,
    stageTitle: null,
    kind: 'learn',
    isEar: false,
    planBlockId: null,
    startedAt: 0,
    finishedAt: null,
    resumed: false,
    visibility: opts.vis,
    pass: null,
    steps,
    questions: [],
    results: opts.done.flatMap((ordinal) => {
      const step = steps[ordinal];
      return step
        ? [
            {
              ordinal,
              stepId: step.id,
              result: 'clean' as const,
              hintLevel: 0,
              chosen: null,
              tries: null,
              playedBack: false,
              elapsedMs: 4000,
            },
          ]
        : [];
    }),
  };
}

const MIDI: Record<string, MidiStatus> = {
  none: { kind: 'no-device' },
  denied: { kind: 'denied' },
  requesting: { kind: 'requesting' },
};
const CONNECTED: MidiStatus = {
  kind: 'connected',
  deviceName: 'Roland FP-30X',
  deviceId: 'fixture',
};

const NO_IO: PracticeIo = {
  recordStep: () => Promise.resolve(),
  setVisibility: () => undefined,
  finish: () => Promise.reject(new Error('The dev screen has no session to finish.')),
};

function parseVis(v: string | null): Visibility {
  return v === 'num' || v === 'name' || v === 'all' ? v : practiceState.vis;
}

function DevPracticeScreen({ search }: { search: string }) {
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const vis = parseVis(params.get('vis'));
  const hint = Math.min(2, Math.max(0, Number(params.get('hint') ?? practiceState.hint) || 0));
  const finished = params.get('finished') === '1';
  const midi = MIDI[params.get('midi') ?? ''] ?? CONNECTED;
  const scale = params.get('level') === 'scale';

  const session = useMemo(
    () =>
      practiceSessionFixture({
        done: finished ? (scale ? [0, 1] : [0, 1, 2, 3, 4, 5, 6]) : scale ? [] : practiceState.done,
        vis,
        scale,
      }),
    [finished, vis, scale],
  );
  const initial = useMemo(() => {
    let s: PracticeState = initialPracticeState(session);
    for (let i = 0; i < hint; i++) s = practiceReducer(s, { type: 'HINT', at: 0 });
    return s;
  }, [session, hint]);
  const practice = usePracticeSession(session, NO_IO, {
    onFinished: () => undefined,
    initial,
    autoFinish: params.get('auto') === '1',
  });

  return (
    <PracticeView
      state={practice.state}
      title={session.levelTitle}
      note={session.levelNote}
      eyebrow={eyebrowFor(session)}
      midiStatus={midi}
      headerMidiStatus={midi}
      // The design shows the Practice:112 link beside a connected keyboard.
      markPlayed={markPlayedMode(midi, true)}
      onHint={practice.hint}
      onSkip={practice.skip}
      onMarkPlayed={practice.markPlayed}
      onVisibility={practice.setVisibility}
      onFinish={practice.finish}
      finishing={practice.finishing}
      finishError={practice.finishError}
      autoFinishing={practice.autoFinishing}
      xpToast={practice.xpToast}
    />
  );
}

function DevPractice() {
  const [params] = useSearchParams();
  const search = params.toString();
  // Remount on knob changes so the fixture state is rebuilt.
  return <DevPracticeScreen key={search} search={search} />;
}

export const devScreens: Record<string, ComponentType> = { practice: DevPractice };
