// /dev/screens/ear-key — Find the key (EarKey.dc.html) over real content, driven through the
// real reducer and hook (no IPC). Knobs:
//   ?tries=G,A         wrong notes before home (default G,A as designed; `?tries=` = first try)
//   ?found=0           still hunting (step 1 current, answers disabled)
//   ?phase=answered    step 2 answered (the right mode, or `?chosen=major` for a miss)
//   ?hinted=1          the hint was used
import type { ComponentType } from 'react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { MidiStatus } from '../../midi/MidiInput';
import { KeyDrillView } from '../ear/KeyDrill';
import { keyDrillState, keySessionFixture } from '../ear/keyFixtures';
import { useEarDrill, type EarIo } from '../ear/useEarDrill';

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

const session = keySessionFixture();

function EarKeyDrill({ search }: { search: string }) {
  const initial = useMemo(() => {
    const params = new URLSearchParams(search);
    const tries = params.get('tries');
    const chosen = params.get('chosen');
    return keyDrillState(session, {
      tries: tries === null ? ['G', 'A'] : tries.split(',').filter((t) => t !== ''),
      found: params.get('found') !== '0',
      answered: params.get('phase') === 'answered',
      hinted: params.get('hinted') === '1',
      ...(chosen !== null ? { chosen } : {}),
    });
  }, [search]);
  const drill = useEarDrill(session, NO_IO, {
    onFinished: () => undefined,
    initial,
    autoPlay: false,
  });
  return (
    <KeyDrillView
      drill={drill}
      title={session.shortTitle}
      backTo="/dev/screens/ear-path"
      midiStatus={CONNECTED}
    />
  );
}

function EarKeyScreen() {
  const [params] = useSearchParams();
  const search = params.toString();
  // Remount on knob changes: the hook takes its initial state once.
  return <EarKeyDrill key={search} search={search} />;
}

export const devScreens: Record<string, ComponentType> = {
  'ear-key': EarKeyScreen,
};
