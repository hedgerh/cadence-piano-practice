import { ButtonBase, type ButtonBaseProps } from './ButtonBase';
import { ArrowRightIcon } from './icons';
import styles from './InkButton.module.css';

/** EarInterval:89–92 — "Next" with a white arrow (18px). */
export function InkButton({ children, ...rest }: Omit<ButtonBaseProps, 'className'>) {
  return (
    <ButtonBase className={styles.ink} {...rest}>
      <span>{children}</span>
      <ArrowRightIcon size={18} />
    </ButtonBase>
  );
}
