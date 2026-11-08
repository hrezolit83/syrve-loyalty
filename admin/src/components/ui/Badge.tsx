import type { ReactNode } from 'react';

import { cx } from '../../cx';
import styles from './Badge.module.css';

type BadgeProps = {
  status?: 'ok' | 'fail' | 'neutral';
  /** Підказка при наведенні — наприклад, текст помилки. */
  title?: string;
  children: ReactNode;
};

export const Badge = ({ status = 'neutral', title, children }: BadgeProps) => (
  <span
    className={cx(styles.badge, status !== 'neutral' && styles[status])}
    title={title}
  >
    {children}
  </span>
);
