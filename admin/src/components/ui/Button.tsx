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

/**
 * Те саме, але посилання.
 *
 * Потрібне для завантаження файлу: <a download> браузер обробляє сам і
 * надсилає cookie, тоді як кнопці довелося б тягнути вміст через fetch
 * і збирати Blob руками.
 */
export const ButtonLink = ({
  variant = 'primary',
  className,
  ...rest
}: ComponentPropsWithoutRef<'a'> & {
  variant?: 'primary' | 'secondary' | 'link';
}) => (
  <a
    className={cx(styles.button, variant !== 'primary' && styles[variant], className)}
    {...rest}
  />
);
