import { cx } from '../../lib/cx';
import { PianoKeyboard, type KeyStates } from '../music/PianoKeyboard/PianoKeyboard';
import styles from './FeedbackPanel.module.css';
import { CheckIcon } from './icons';
import { InkButton } from './InkButton';
import { PulseDot } from './PulseDot';

export interface FeedbackPanelProps {
  correct: boolean;
  title: string;
  body: string;
  /** "C then F" → "Play it back: C then F · +5 XP". */
  playback: string;
  /** The play-back was verified on MIDI: the line confirms the +5 XP (engine.md §6.11). */
  playedBack?: boolean;
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
  playedBack = false,
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
        <span className={styles.title} data-testid="feedback-title">
          {title}
        </span>
        <span className={styles.body} data-testid="feedback-body">
          {body}
        </span>
        <div className={styles.playback} data-testid="playback-line" data-played-back={playedBack}>
          {playedBack ? <CheckIcon size={14} strokeWidth={3.2} /> : <PulseDot size={10} pulsing />}
          <span>
            {playedBack ? `Played back: ${playback} · +5 XP` : `Play it back: ${playback} · +5 XP`}
          </span>
        </div>
      </div>
      <PianoKeyboard variant="one-octave" states={keys} data-testid="feedback-keyboard" />
      <InkButton data-testid="feedback-next" {...(onNext ? { onClick: onNext } : {})}>
        Next
      </InkButton>
    </div>
  );
}
