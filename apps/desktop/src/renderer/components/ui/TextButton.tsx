import { cx } from '../../lib/cx';
import { ButtonBase, type ButtonBaseProps } from './ButtonBase';
import styles from './TextButton.module.css';

export interface TextButtonProps extends Omit<ButtonBaseProps, 'className'> {
  /** Practice:112 "No keyboard? Mark as played" — underline, offset 4. */
  underline?: boolean;
}

/** Practice:113 "Skip for now". */
export function TextButton({ underline = false, children, ...rest }: TextButtonProps) {
  return (
    <ButtonBase className={cx(styles.text, underline && styles.underline)} {...rest}>
      {children}
    </ButtonBase>
  );
}
