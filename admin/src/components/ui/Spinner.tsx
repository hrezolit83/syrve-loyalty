import { Loader2 } from 'lucide-react';

import { cx } from '../../cx';
import styles from './Spinner.module.css';

/**
 * Індикатор очікування відповіді сервера.
 *
 * Обертання — через CSS Module, а не inline-стиль: анімація належить
 * вигляду, і так її видно в одному місці разом із правилом для
 * prefers-reduced-motion.
 */
export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={cx(styles.spinner, className)} aria-hidden="true" />
);
