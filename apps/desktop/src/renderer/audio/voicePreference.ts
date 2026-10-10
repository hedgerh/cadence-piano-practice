// decisions.md 2026-10-11 "Sound setting": keep the synth's voice in step with the profile.
// Applied from the cached `me.get` query (first fetch, `me.update` results, invalidations), so
// every screen that changes the setting only has to update the profile.
import { hashKey, type QueryClient } from '@tanstack/react-query';
import type { ChannelOutput } from '@shared/ipc/contracts';
import type { Synth } from './Synth';

type MeDto = ChannelOutput<'me.get'>;

/** Apply the profile's voice now (if cached) and on every change; returns the unsubscribe. */
export function installVoicePreference(
  qc: QueryClient,
  synth: Pick<Synth, 'setVoice'>,
  key: readonly unknown[],
): () => void {
  const apply = (me: MeDto | undefined) => {
    if (me) synth.setVoice(me.settings.voice);
  };
  apply(qc.getQueryData<MeDto>(key));
  const hash = hashKey(key);
  return qc.getQueryCache().subscribe((event) => {
    if (event.query.queryHash === hash) apply(event.query.state.data as MeDto | undefined);
  });
}
