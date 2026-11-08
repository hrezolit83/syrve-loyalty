import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cx } from '../../cx';
import styles from './Field.module.css';

type FieldProps = ComponentPropsWithoutRef<'input'> & {
  label: ReactNode;
  /** Пояснення під полем: що саме сюди можна ввести. */
  hint?: ReactNode;
  /** Зайняти всю вільну ширину в рядку форми. */
  grow?: boolean;
};

/**
 * Підпис і поле вводу одним блоком.
 *
 * Input лежить усередині label, тому окремий htmlFor не потрібен —
 * клік по підпису фокусує поле, і скрінрідер читає їх разом.
 */
export const Field = ({
  label,
  hint,
  grow = false,
  className,
  ...inputProps
}: FieldProps) => (
  <label className={cx(styles.field, grow && styles.grow, className)}>
    {label}
    <input className={styles.input} {...inputProps} />
    {hint && <span className={styles.hint}>{hint}</span>}
  </label>
);
