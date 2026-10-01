import type { ReactNode } from 'react';
import { ButtonBase, type ButtonBaseProps } from './ButtonBase';
import styles from './SecondaryButton.module.css';

export interface SecondaryButtonProps extends Omit<ButtonBaseProps, 'className'> {
  /** Leading icon, e.g. Learn:88's play triangle. */
  icon?: ReactNode;
}

/** Complete:79 "Done for today", Path:89 "Review a finished key", Learn:87. */
export function SecondaryButton({ icon, children, ...rest }: SecondaryButtonProps) {
  return (
    <ButtonBase className={styles.secondary} {...rest}>
      {icon}
      <span>{children}</span>
    </ButtonBase>
  );
}
