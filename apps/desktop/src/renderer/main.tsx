import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { queryClient } from './lib/queryClient';
import { detectRuntimeMode } from './lib/runtimeMode';
import { createAppRouter } from './app/router';
import { initAppMidi } from './midi/appMidi';
import {
  installMidiPreferenceIo,
  livePreferenceIo,
  restoreMidiPreference,
} from './midi/devicePreference';
import { appMidi } from './midi/midiStore';
import { api, queryKey } from './lib/api';
import { appSynth, installAudioUnlock } from './audio/useAudio';
import { installVoicePreference } from './audio/voicePreference';
import { installLiveMonitor } from './audio/liveMonitor';
import { installDevHooks } from './dev/devHooks';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
const root = createRoot(container);

async function boot(): Promise<void> {
  // One app.ping decides whether dev routes and window.__cadenceDev exist (dev / e2e).
  const mode = await detectRuntimeMode();
  const devInput = initAppMidi({ dev: mode.dev, devTools: mode.devTools });
  if (mode.devTools && devInput) installDevHooks(devInput, mode);
  // Task 16: listen to the keyboard picked last time (me.midi), once the profile is read.
  const midiIo = livePreferenceIo(queryClient, api, queryKey('me.get'));
  installMidiPreferenceIo(midiIo);
  void restoreMidiPreference(appMidi, midiIo);
  installAudioUnlock();
  // decisions.md 2026-10-11 "Sound setting": the synth plays the profile's chosen voice.
  installVoicePreference(queryClient, appSynth, queryKey('me.get'));
  // decisions.md 2026-10-13 "Play my notes": what the learner plays sounds through the app.
  installLiveMonitor(appMidi, appSynth);
  void queryClient.prefetchQuery({ queryKey: queryKey('me.get'), queryFn: () => api['me.get']() });

  const router = createAppRouter({ devRoutes: mode.devTools });
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void boot();
