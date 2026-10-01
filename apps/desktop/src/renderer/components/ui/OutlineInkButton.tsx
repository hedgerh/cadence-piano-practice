import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { ButtonBase, type ButtonBaseProps } from './ButtonBase';
import styles from './OutlineInkButton.module.css';

export interface OutlineInkButtonProps extends Omit<ButtonBaseProps, 'className'> {
  /** 48 (Practice:194 hint button) or 60 (EarKey:92 answer buttons). */
  size?: 48 | 60;
  icon?: ReactNode;
}

export function OutlineInkButton({ size = 48, icon, children, ...rest }: OutlineInkButtonProps) {
  return (
    <ButtonBase className={cx(styles.outline, size === 48 ? styles.s48 : styles.s60)} {...rest}>
      {icon}
      <span>{children}</span>
    </ButtonBase>
  );
}
