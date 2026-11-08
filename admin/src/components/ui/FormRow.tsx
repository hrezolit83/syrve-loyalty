import type { ReactNode } from 'react';

import styles from './FormRow.module.css';

/** Рядок форми: поля поруч, із переносом на вузькому екрані. */
export const FormRow = ({ children }: { children: ReactNode }) => (
  <div className={styles.row}>{children}</div>
);
