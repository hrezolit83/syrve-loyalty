import type { FormEventHandler, ReactNode } from 'react';

import { cx } from '../../cx';
import styles from './Card.module.css';

type CardProps = {
  className?: string;
  children: ReactNode;
};

/** Біла картка-контейнер — основний блок панелі. */
export const Card = ({ className, children }: CardProps) => (
  <div className={cx(styles.card, className)}>{children}</div>
);

/**
 * Та сама картка, але сама по собі форма.
 *
 * Окремий компонент замість пропа `as`: варіантів лише два, а так
 * обидва лишаються повністю типізованими без дженериків.
 */
export const CardForm = ({
  className,
  onSubmit,
  children,
}: CardProps & { onSubmit: FormEventHandler<HTMLFormElement> }) => (
  <form className={cx(styles.card, className)} onSubmit={onSubmit}>
    {children}
  </form>
);

/** Заголовок картки. */
export const CardTitle = ({ children }: { children: ReactNode }) => (
  <h2 className={styles.title}>{children}</h2>
);
