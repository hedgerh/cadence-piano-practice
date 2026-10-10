import { useId } from 'react';
import type { SoundVoice } from '@shared/ipc/contracts';
import { cx } from '../../lib/cx';
import styles from './ShowMeControl.module.css';

/** In the order they were added: the original tone, then the two pianos. */
export const SOUND_OPTIONS: ReadonlyArray<{ value: SoundVoice; label: string }> = [
  { value: 'tone', label: 'Tone' },
  { value: 'synth', label: 'Synth piano' },
  { value: 'samples', label: 'Recorded piano' },
];

export interface SoundControlProps {
  value: SoundVoice;
  onChange: (value: SoundVoice) => void;
}

/**
 * decisions.md 2026-10-11 "Sound setting" — not in the designs. The Show me control's look
 * (Practice:48–55: label + sand well of 44px segments) with the app's three voices.
 */
export function SoundControl({ value, onChange }: SoundControlProps) {
  const labelId = useId();
  return (
    <div className={styles.control} data-testid="sound-control">
      <span className={styles.label} id={labelId}>
        Sound
      </span>
      <div className={styles.well} role="group" aria-labelledby={labelId}>
        {SOUND_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={cx(styles.seg, value === o.value && styles.on)}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            data-testid={`sound-${o.value}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
