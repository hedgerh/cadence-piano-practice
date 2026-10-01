import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '../../lib/cx';
import { appPreferenceIo, chooseMidiDevice } from '../../midi/devicePreference';
import { useMidiDevices, useMidiHub, useMidiStatus } from '../../midi/hooks';
import type { MidiDeviceInfo, MidiStatus } from '../../midi/MidiInput';
import { CheckIcon, ChevronDownIcon } from './icons';
import styles from './Pill.module.css';
import { PulseDot } from './PulseDot';

export interface MidiPillProps {
  /** Fixed status (dev fixtures): renders the static pill. Defaults to the live store + picker. */
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

/** Task 16: the picker's note when no port is listed (not in the designs; no red). */
export function midiMenuEmptyText(status: MidiStatus): string {
  switch (status.kind) {
    case 'requesting':
      return 'Looking for keyboards…';
    case 'denied':
      return 'Windows is blocking MIDI. Allow it in Settings → Privacy, then restart Cadence.';
    case 'unsupported':
      return 'MIDI isn’t available on this computer.';
    case 'connected':
    case 'no-device':
      return 'No keyboard found. Plug one in by USB — it shows up here.';
  }
}

/** Main:36–39, Practice:32–35. Connected → teal-deep dot; otherwise a dune dot. */
export function MidiPill({ status, variant = 'app' }: MidiPillProps) {
  if (status !== undefined) return <StaticMidiPill status={status} variant={variant} />;
  return <LiveMidiPill variant={variant} />;
}

function PillFace({ status, variant }: { status: MidiStatus; variant: 'app' | 'task' }) {
  const connected = status.kind === 'connected';
  const pulsing = (connected && variant === 'task') || status.kind === 'requesting';
  return (
    <>
      <PulseDot size={10} tone={connected ? 'teal-deep' : 'dune'} pulsing={pulsing} />
      <span className={styles.label}>{midiPillLabel(status, variant)}</span>
    </>
  );
}

function StaticMidiPill({ status, variant }: { status: MidiStatus; variant: 'app' | 'task' }) {
  return (
    <div
      className={cx(styles.pill, styles.midi, variant === 'task' && styles.inline)}
      data-testid="midi-pill"
      data-status={status.kind}
      title={midiPillLabel(status, 'app')}
    >
      <PillFace status={status} variant={variant} />
    </div>
  );
}

/**
 * Task 16 device picker: the pill is a button that opens a menu of `access.inputs`; the
 * choice switches the hub at once and is saved with `me.update {midi}` (restored on launch).
 * With no port it explains why, and that the computer keys play instead.
 */
function LiveMidiPill({ variant }: { variant: 'app' | 'task' }) {
  const status = useMidiStatus();
  const devices = useMidiDevices();
  const hub = useMidiHub();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const activeId = status.kind === 'connected' ? status.deviceId : null;

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  // Close on outside pointer-down.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, close]);

  // Focus the checked (or first) item when the menu opens.
  useEffect(() => {
    if (!open) return;
    const items = wrap.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
    const list = items ? [...items] : [];
    (list.find((el) => el.getAttribute('aria-checked') === 'true') ?? list[0])?.focus();
  }, [open]);

  const pick = (device: MidiDeviceInfo) => {
    void chooseMidiDevice(hub, device, appPreferenceIo());
    close(true);
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      close(e.key === 'Escape');
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') {
      return;
    }
    e.preventDefault();
    const items = [
      ...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
    ];
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div className={styles.midiWrap} ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className={cx(
          styles.pill,
          styles.midi,
          styles.trigger,
          variant === 'task' && styles.inline,
        )}
        data-testid="midi-pill"
        data-status={status.kind}
        title={midiPillLabel(status, 'app')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <PillFace status={status} variant={variant} />
        {devices.length > 1 && (
          <span className={styles.caret} aria-hidden="true">
            <ChevronDownIcon />
          </span>
        )}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="MIDI keyboards"
          className={styles.menu}
          data-testid="midi-menu"
          onKeyDown={onMenuKey}
        >
          <span className={styles.menuTitle}>Keyboards</span>
          {devices.map((d) => {
            const checked = d.id === activeId;
            return (
              <button
                key={d.id}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                className={cx(styles.menuItem, checked && styles.menuItemOn)}
                data-device-id={d.id}
                onClick={() => pick(d)}
              >
                <span className={styles.menuName}>{d.name}</span>
                {checked && <CheckIcon size={16} />}
              </button>
            );
          })}
          {devices.length === 0 && (
            <span className={styles.menuNote} data-testid="midi-menu-empty">
              {midiMenuEmptyText(status)}
            </span>
          )}
          {devices.length === 0 && (
            <span className={styles.menuNote}>
              Meanwhile your computer keys play notes: the home row, A to ;, is C4 to E5.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
