import type { ReactNode } from 'react';

import { cx } from '../../cx';
import styles from './Alert.module.css';

type AlertProps = {
  variant?: 'error' | 'success';
  children: ReactNode;
};

/** Повідомлення про помилку або успіх під формою. */
export const Alert = ({ variant = 'error', children }: AlertProps) => (
  <div className={cx(styles.alert, styles[variant])}>{children}</div>
);
