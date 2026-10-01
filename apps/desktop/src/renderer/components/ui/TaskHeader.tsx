import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import type { MidiStatus } from '../../midi/MidiInput';
import { ArrowLeftIcon } from './icons';
import { MidiPill } from './MidiPill';
import styles from './TaskHeader.module.css';

export type EyebrowTone = 'tangerine' | 'lavender' | 'teal';

export interface TaskHeaderProps {
  backTo: string;
  backLabel: string;
  eyebrow: string;
  eyebrowTone: EyebrowTone;
  /**
   * `task` (Practice:22–37): back in a 220px slot, centred title + eyebrow, MidiPill right.
   * `lesson` (Learn:20–27): back link, eyebrow only (13px), 80px spacer.
   */
  variant?: 'task' | 'lesson';
  title?: string;
  /** Overrides the live MIDI status (gallery / fixtures). */
  midiStatus?: MidiStatus | undefined;
}

export function TaskHeader({
  backTo,
  backLabel,
  eyebrow,
  eyebrowTone,
  variant = 'task',
  title,
  midiStatus,
}: TaskHeaderProps) {
  const tone = styles[eyebrowTone];
  if (variant === 'lesson') {
    return (
      <header className={styles.header} data-testid="task-header">
        <Link to={backTo} className={styles.back}>
          <ArrowLeftIcon />
          <span>{backLabel}</span>
        </Link>
        <span className={cx(styles.eyebrow, styles.eyebrowLesson, tone)}>{eyebrow}</span>
        <span className={styles.spacer} />
      </header>
    );
  }
  return (
    <header className={styles.header} data-testid="task-header">
      <Link to={backTo} className={cx(styles.back, styles.slot)}>
        <ArrowLeftIcon />
        <span>{backLabel}</span>
      </Link>
      <div className={styles.center}>
        {title !== undefined && <span className={styles.title}>{title}</span>}
        <span className={cx(styles.eyebrow, tone)}>{eyebrow}</span>
      </div>
      <div className={styles.right}>
        <MidiPill status={midiStatus} variant="task" />
      </div>
    </header>
  );
}
