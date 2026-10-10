// decisions.md 2026-10-11 "Sound setting": the profile's voice as a SoundControl. Switching
// takes effect at once (the synth is told directly) and is saved with `me.update`; the
// voice preference (audio/voicePreference.ts) keeps the synth in step with the saved value.
import { useContext, useState } from 'react';
import type { SoundVoice } from '@shared/ipc/contracts';
import { SynthContext } from '../../audio/useAudio';
import { SoundControl } from '../../components/ui/SoundControl';
import { useMe, useUpdateMe } from './hooks';

export function SoundSetting() {
  const me = useMe();
  const update = useUpdateMe();
  const synth = useContext(SynthContext);
  const [chosen, setChosen] = useState<SoundVoice | null>(null);
  const value = chosen ?? me.data?.settings.voice ?? 'samples';
  return (
    <SoundControl
      value={value}
      onChange={(voice) => {
        setChosen(voice);
        synth.setVoice(voice);
        update.mutate(
          { settings: { voice } },
          {
            onError: () => {
              setChosen(null);
              synth.setVoice(me.data?.settings.voice ?? 'samples');
            },
          },
        );
      }}
    />
  );
}
