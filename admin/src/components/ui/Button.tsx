import type { ComponentPropsWithoutRef } from 'react';

import { cx } from '../../cx';
import styles from './Button.module.css';

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  /** primary — основна дія, secondary — другорядна, link — як посилання. */
  variant?: 'primary' | 'secondary' | 'link';
};

export const Button = ({
  variant = 'primary',
  className,
  ...rest
}: ButtonProps) => (
  <button
    className={cx(styles.button, variant !== 'primary' && styles[variant], className)}
    {...rest}
  />
);
