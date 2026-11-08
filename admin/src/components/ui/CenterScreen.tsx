import type { ReactNode } from 'react';

import { cx } from '../../cx';
import styles from './CenterScreen.module.css';

/** Вміст по центру всього вікна — вхід і стан завантаження. */
export const CenterScreen = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => <div className={cx(styles.screen, className)}>{children}</div>;
