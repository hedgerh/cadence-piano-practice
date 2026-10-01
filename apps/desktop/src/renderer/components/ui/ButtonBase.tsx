import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import styles from './Button.module.css';

export interface ButtonBaseProps {
  /** Router destination: renders a Link instead of a <button>. */
  to?: string | undefined;
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
  type?: 'button' | 'submit' | undefined;
  'aria-label'?: string | undefined;
  'aria-pressed'?: boolean | undefined;
  'data-testid'?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** A <button> (or router Link when `to` is set) sharing the design buttons' reset. */
export function ButtonBase({
  to,
  onClick,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonBaseProps) {
  const classes = cx(styles.base, className);
  if (to !== undefined && !disabled) {
    return (
      <Link to={to} className={classes} onClick={onClick} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}
