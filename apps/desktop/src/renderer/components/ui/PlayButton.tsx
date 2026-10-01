import { cx } from '../../lib/cx';
import { ButtonBase } from './ButtonBase';
import { NoteIcon, SpeakerIcon } from './icons';
import styles from './PlayButton.module.css';

export interface PlayButtonProps {
  /** 112: the main "play the sound" button · 72: "Hear the key" (EarChord:59). */
  size?: 112 | 72;
  'aria-label': string;
  onClick?: () => void;
  disabled?: boolean;
  'data-testid'?: string;
}

export function PlayButton({ size = 112, ...rest }: PlayButtonProps) {
  return (
    <ButtonBase className={cx(styles.play, size === 112 ? styles.s112 : styles.s72)} {...rest}>
      {size === 112 ? <SpeakerIcon size={48} /> : <NoteIcon size={30} />}
    </ButtonBase>
  );
}
