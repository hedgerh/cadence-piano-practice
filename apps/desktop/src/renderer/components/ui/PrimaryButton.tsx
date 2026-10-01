import { cx } from '../../lib/cx';
import { ButtonBase, type ButtonBaseProps } from './ButtonBase';
import { ArrowRightIcon } from './icons';
import styles from './PrimaryButton.module.css';

export interface PrimaryButtonProps extends Omit<ButtonBaseProps, 'className'> {
  /** 60 (Main:105, Today CTA) or 56 (Practice:82 and everywhere else). */
  size?: 60 | 56;
}

/** Tangerine CTA with the trailing arrow (Main:107: 22px; Practice:84: 20px). */
export function PrimaryButton({ size = 56, children, ...rest }: PrimaryButtonProps) {
  return (
    <ButtonBase className={cx(styles.primary, size === 60 ? styles.s60 : styles.s56)} {...rest}>
      <span>{children}</span>
      <ArrowRightIcon size={size === 60 ? 22 : 20} />
    </ButtonBase>
  );
}
