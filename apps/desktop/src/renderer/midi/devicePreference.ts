// Task 16: the MidiPill's device choice is saved with `me.update {midi}` and restored on launch.
import type { QueryClient } from '@tanstack/react-query';
import type { ChannelInput, ChannelOutput } from '@shared/ipc/contracts';
import type { MidiDeviceInfo, MidiDevicePreference } from './MidiInput';
import type { MidiHub } from './midiStore';

type MeDto = ChannelOutput<'me.get'>;

export interface PreferenceIo {
  getMe: () => Promise<MeDto>;
  updateMe: (input: ChannelInput<'me.update'>) => Promise<MeDto>;
  /** The cached profile, if any (skip saving before onboarding has created one). */
  cachedMe: () => MeDto | undefined;
  /** Store the updated profile in the query cache. */
  setMe: (me: MeDto) => void;
}

/** The saved keyboard from the profile, or null when none was chosen. */
export function preferenceOf(me: Pick<MeDto, 'midi'>): MidiDevicePreference | null {
  const id = me.midi.deviceId ?? null;
  const name = me.midi.deviceName ?? null;
  return id === null && name === null ? null : { id, name };
}

/** On launch: read `me.midi` and listen to that keyboard when it is plugged in. */
export async function restoreMidiPreference(hub: MidiHub, io: PreferenceIo): Promise<void> {
  try {
    const me = await io.getMe();
    if (me.firstRun) return;
    const pref = preferenceOf(me);
    if (pref) hub.selectDevice(pref);
  } catch {
    // No profile access (e.g. the main process is still starting): keep the first device.
  }
}

let appIo: PreferenceIo | null = null;

/** main.tsx registers the IPC wiring (components never import lib/api directly). */
export function installMidiPreferenceIo(io: PreferenceIo): void {
  appIo = io;
}

export function appPreferenceIo(): PreferenceIo | null {
  return appIo;
}

/** The picker: switch the hub to `device` at once, then persist it (never on first run). */
export async function chooseMidiDevice(
  hub: MidiHub,
  device: MidiDeviceInfo,
  io: PreferenceIo | null,
): Promise<void> {
  hub.selectDevice({ id: device.id, name: device.name });
  if (!io) return;
  try {
    const me = io.cachedMe() ?? (await io.getMe());
    if (me.firstRun) return;
    io.setMe(await io.updateMe({ midi: { deviceId: device.id, deviceName: device.name } }));
  } catch {
    // The live choice still applies for this run; it is simply not remembered.
  }
}

/** The real IPC + TanStack cache wiring (renderer/lib). */
export function livePreferenceIo(
  qc: QueryClient,
  api: {
    'me.get': () => Promise<MeDto>;
    'me.update': (input: ChannelInput<'me.update'>) => Promise<MeDto>;
  },
  key: readonly unknown[],
): PreferenceIo {
  return {
    getMe: () => qc.fetchQuery({ queryKey: key, queryFn: () => api['me.get']() }),
    updateMe: (input) => api['me.update'](input),
    cachedMe: () => qc.getQueryData<MeDto>(key),
    setMe: (me) => qc.setQueryData(key, me),
  };
}
