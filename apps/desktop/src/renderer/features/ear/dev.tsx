// /dev/screens/ear-interval · ear-results · ear-degrees · ear-quality · ear-chord — the ear drill
// and its results over real content, driven through the real reducer and hook (no IPC).
// Knobs: ear-interval|ear-degrees|ear-quality|ear-chord ?phase=listen|answered ;
// ear-chord ?visibility=num (numerals only) ; ear-results ?result=pass|fail|focus
import type { ComponentType } from 'react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { earIntervalState } from '../../dev/fixtures/earInterval';
import type { MidiStatus } from '../../midi/MidiInput';
import { ChoiceDrill } from './ChoiceDrill';
import { stageKindOf, type Visibility } from './choiceModel';
import {
  earReducer,
  initialEarState,
  type EarDrillState,
  type EarSession,
} from './earDrillReducer';
import { EarResultsView } from './EarResultsView';
import { earCompleteFixture, earSessionFixture, INTERVAL_ORDER, levelOf } from './fixtures';
import { useEarDrill, type EarIo } from './useEarDrill';

const CONNECTED: MidiStatus = {
  kind: 'connected',
  deviceName: 'Roland FP-30X',
  deviceId: 'fixture',
};

const NO_IO: EarIo = {
  recordStep: () => Promise.resolve(),
  recordPlayback: () => Promise.resolve(),
  finish: () => Promise.reject(new Error('The dev screen has no session to finish.')),
};

/** Played and (optionally) answered with `chosen` — the reducer path the live drill takes. */
function stateFor(session: EarSession, phase: string, chosen: string | null): EarDrillState {
  let s = initialEarState(session);
  if (phase !== 'answered') return s;
  s = earReducer(s, { type: 'PLAY_START', q: s.q, at: 0 });
  s = earReducer(s, { type: 'PLAY_END', q: s.q, at: 0 });
  const q = s.questions[s.q];
  const pick = chosen ?? (q?.match.type === 'choice' ? q.match.answer : '');
  return earReducer(s, { type: 'PICK', option: pick, at: 3000 });
}

function DrillScreen({
  session,
  phase,
  chosen,
  visibility = 'all',
}: {
  session: EarSession;
  phase: string;
  chosen: string | null;
  visibility?: Visibility;
}) {
  const { level, stage } = levelOf(session.levelId);
  const initial = useMemo(() => stateFor(session, phase, chosen), [session, phase, chosen]);
  const drill = useEarDrill(session, NO_IO, {
    onFinished: () => undefined,
    initial,
    autoPlay: false,
  });
  return (
    <ChoiceDrill
      drill={drill}
      kind={stageKindOf(stage.id)}
      title={session.shortTitle}
      activeOptions={level.activeOptions ?? null}
      backTo="/dev/screens/ear-path"
      midiStatus={CONNECTED}
      visibility={visibility}
    />
  );
}

function usePhase(): string {
  const [params] = useSearchParams();
  return params.get('phase') === 'answered' ? 'answered' : 'listen';
}

// EarInterval:103 — results [right, right, missed], question 4 is C → F (P4), chosen M3.
const intervalSession = earSessionFixture(
  'intervals-3',
  INTERVAL_ORDER.map((iv) => `up-C4-${iv}`),
  [
    { stepId: 'up-C4-P5', chosen: 'P5' },
    { stepId: 'up-C4-M3', chosen: 'M3' },
    { stepId: 'up-C4-m3', chosen: 'M2' },
  ],
);

function EarIntervalScreen() {
  const phase = usePhase();
  return (
    <DrillScreen
      key={phase}
      session={intervalSession}
      phase={phase}
      chosen={earIntervalState.chosen}
    />
  );
}

const degreesSession = earSessionFixture(
  'scale-degrees-1',
  [3, 1, 5, 3, 5, 1, 3, 5, 1, 5].map((d) => `c-major-${d}`),
);

function EarDegreesScreen() {
  const phase = usePhase();
  return <DrillScreen key={phase} session={degreesSession} phase={phase} chosen={null} />;
}

const qualitySession = earSessionFixture('chord-quality-1', [
  'a-minor',
  'c-major',
  'd-minor',
  'g-major',
  'e-minor',
  'f-major',
  'a-major',
  'bb-major',
  'd-major',
  'e-major',
]);

function EarQualityScreen() {
  const phase = usePhase();
  return <DrillScreen key={phase} session={qualitySession} phase={phase} chosen={null} />;
}

// EarChord:41–52 — results [right, right, missed, right, right], question 6 is IV in G major.
const chordSession = earSessionFixture(
  'chords-in-key-2',
  ['I', 'V', 'iii', 'ii', 'vi', 'IV', 'viidim', 'V', 'I', 'ii'].map((n) => `g-major-${n}`),
  [
    { stepId: 'g-major-I', chosen: 'I' },
    { stepId: 'g-major-V', chosen: 'V' },
    { stepId: 'g-major-iii', chosen: 'vi' },
    { stepId: 'g-major-ii', chosen: 'ii' },
    { stepId: 'g-major-vi', chosen: 'vi' },
  ],
);

function EarChordScreen() {
  const phase = usePhase();
  const [params] = useSearchParams();
  const visibility: Visibility = params.get('visibility') === 'num' ? 'num' : 'all';
  return (
    <DrillScreen
      key={`${phase}-${visibility}`}
      session={chordSession}
      phase={phase}
      chosen={null}
      visibility={visibility}
    />
  );
}

function EarResultsScreen() {
  const [params] = useSearchParams();
  const result = params.get('result');
  const complete =
    result === 'focus'
      ? earCompleteFixture(true, { focus: true, missed: [3] })
      : earCompleteFixture(result !== 'fail');
  return <EarResultsView complete={complete} onAction={() => undefined} />;
}

export const devScreens: Record<string, ComponentType> = {
  'ear-interval': EarIntervalScreen,
  'ear-results': EarResultsScreen,
  'ear-degrees': EarDegreesScreen,
  'ear-quality': EarQualityScreen,
  'ear-chord': EarChordScreen,
};
