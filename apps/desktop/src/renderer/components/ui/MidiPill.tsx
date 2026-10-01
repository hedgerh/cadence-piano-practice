import { useMidiStatus } from '../../midi/hooks';
import type { MidiStatus } from '../../midi/MidiInput';
import { cx } from '../../lib/cx';
import styles from './Pill.module.css';
import { PulseDot } from './PulseDot';

export interface MidiPillProps {
  /** Defaults to the live status from the MIDI store. */
  status?: MidiStatus | undefined;
  /** `app` (Main:36: "<name> connected", flex) or `task` (Practice:32: name only, inline-flex, pulsing dot). */
  variant?: 'app' | 'task';
}

/** ui.md §4 copy for each status. */
export function midiPillLabel(status: MidiStatus, variant: 'app' | 'task'): string {
  switch (status.kind) {
    case 'connected':
      return variant === 'app' ? `${status.deviceName} connected` : status.deviceName;
    case 'no-device':
      return 'No keyboard found';
    case 'requesting':
      return 'Looking for keyboards…';
    case 'denied':
      return 'MIDI access blocked';
    case 'unsupported':
      return 'MIDI unavailable';
  }
}

/** Main:36–39, Practice:32–35. Connected → teal-deep dot; otherwise a dune dot. */
export function MidiPill({ status, variant = 'app' }: MidiPillProps) {
  const live = useMidiStatus();
  const s = status ?? live;
  const connected = s.kind === 'connected';
  const pulsing = (connected && variant === 'task') || s.kind === 'requesting';
  return (
    <div
      className={cx(styles.pill, styles.midi, variant === 'task' && styles.inline)}
      data-testid="midi-pill"
      data-status={s.kind}
    >
      <PulseDot size={10} tone={connected ? 'teal-deep' : 'dune'} pulsing={pulsing} />
      <span>{midiPillLabel(s, variant)}</span>
    </div>
  );
}
