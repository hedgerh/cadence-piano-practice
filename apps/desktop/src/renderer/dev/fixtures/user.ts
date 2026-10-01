// Shared sample learner across the designs (Main:22–39, Main:47).
import type { MidiStatus } from '../../midi/MidiInput';

export const user = {
  name: 'Harry',
  /** Main:47 — evening greeting. */
  greeting: 'Good evening, Harry.',
  streakDays: 8,
  xp: 1240,
} as const;

/** Main:38 / Practice:34 — Roland FP-30X. */
export const connectedMidi: MidiStatus = {
  kind: 'connected',
  deviceName: 'Roland FP-30X',
  deviceId: 'roland-fp-30x',
};

export const midiStatuses: Readonly<Record<MidiStatus['kind'], MidiStatus>> = {
  connected: connectedMidi,
  'no-device': { kind: 'no-device' },
  requesting: { kind: 'requesting' },
  denied: { kind: 'denied' },
  unsupported: { kind: 'unsupported' },
};
