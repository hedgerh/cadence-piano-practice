import { cx } from '../../lib/cx';
import { PianoKeyboard, type KeyStates } from '../music/PianoKeyboard/PianoKeyboard';
import styles from './FeedbackPanel.module.css';
import { InkButton } from './InkButton';
import { PulseDot } from './PulseDot';

export interface FeedbackPanelProps {
  correct: boolean;
  title: string;
  body: string;
  /** "C then F" → "Play it back: C then F · +5 XP". */
  playback: string;
  /** One-octave keyboard lighting (correct notes teal). */
  keys: KeyStates;
  onNext?: () => void;
  /** EarInterval:73 (260) · EarChord:87 (280). */
  minTextWidth?: 260 | 280;
}

/** EarInterval:72–93, 178 · EarChord:86–107. No red: a miss is the soft tangerine panel. */
export function FeedbackPanel({
  correct,
  title,
  body,
  playback,
  keys,
  onNext,
  minTextWidth = 260,
}: FeedbackPanelProps) {
  return (
    <div
      className={cx(styles.panel, correct ? styles.correct : styles.wrong)}
      data-testid="feedback-panel"
      data-correct={correct}
    >
      <div className={styles.text} style={{ minWidth: minTextWidth }}>
        <span className={styles.title}>{title}</span>
        <span className={styles.body}>{body}</span>
        <div className={styles.playback}>
          <PulseDot size={10} pulsing />
          <span>Play it back: {playback} · +5 XP</span>
        </div>
      </div>
      <PianoKeyboard variant="one-octave" states={keys} />
      <InkButton {...(onNext ? { onClick: onNext } : {})}>Next</InkButton>
    </div>
  );
}
