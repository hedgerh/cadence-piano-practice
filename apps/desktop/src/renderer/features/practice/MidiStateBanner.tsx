// docs/ui.md §3 row `/practice/:levelId` and §4 MidiPill copy: the line under the keyboard.
// Connected → Practice:102 ListeningIndicator; otherwise the requesting / no-device / denied
// variants (dune dot, never red).
import { ListeningIndicator } from '../../components/ui/ListeningIndicator';
import { PulseDot } from '../../components/ui/PulseDot';
import type { MidiStatus } from '../../midi/MidiInput';
import styles from './MidiStateBanner.module.css';

export function MidiStateBanner({ status }: { status: MidiStatus }) {
  switch (status.kind) {
    case 'connected':
      return <ListeningIndicator />;
    case 'requesting':
      return (
        <div
          className={styles.line}
          data-testid="midi-banner"
          data-status="requesting"
          role="status"
        >
          <PulseDot size={12} tone="dune" pulsing />
          <span>Looking for keyboards…</span>
        </div>
      );
    case 'no-device':
    case 'unsupported':
      return (
        <div
          className={styles.line}
          data-testid="midi-banner"
          data-status={status.kind}
          role="status"
        >
          <PulseDot size={12} tone="dune" />
          <span>
            {status.kind === 'unsupported' ? 'MIDI unavailable' : 'No keyboard found'} — plug one
            in, or play on your computer keys
          </span>
        </div>
      );
    case 'denied':
      return (
        <div className={styles.card} data-testid="midi-banner" data-status="denied" role="status">
          <div className={styles.cardTitle}>
            <PulseDot size={12} tone="dune" />
            <span>MIDI access blocked</span>
          </div>
          <p className={styles.cardBody}>
            Cadence can&apos;t hear your keyboard. In Windows Settings → Privacy &amp; security,
            allow apps to use MIDI devices, then restart Cadence. Until then, mark each chord as
            played.
          </p>
        </div>
      );
  }
}
