import { ButtonBase, type ButtonBaseProps } from './ButtonBase';
import styles from './DashedButton.module.css';
import { PlusIcon } from './icons';

/** Main:162–165 "Add something to learn". */
export function DashedButton({ children, ...rest }: Omit<ButtonBaseProps, 'className'>) {
  return (
    <ButtonBase className={styles.dashed} {...rest}>
      <PlusIcon />
      <span>{children}</span>
    </ButtonBase>
  );
}
