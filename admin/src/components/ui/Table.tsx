import type { ReactNode } from 'react';

import { cx } from '../../cx';
import styles from './Table.module.css';

type CellProps = {
  /** Вирівняти вміст по правому краю — для сум. */
  right?: boolean;
  /** Заборонити перенос — для дат, сум і номерів. */
  nowrap?: boolean;
  /** Другорядне значення: приглушений колір. */
  muted?: boolean;
  className?: string;
  children?: ReactNode;
};

/** Таблиця журналу. Вигляд комірок задається пропсами, а не класами ззовні. */
export const Table = ({ children }: { children: ReactNode }) => (
  <table className={styles.table}>{children}</table>
);

export const Tr = ({
  dimmed = false,
  children,
}: {
  dimmed?: boolean;
  children: ReactNode;
}) => <tr className={cx(dimmed && styles.dimmed)}>{children}</tr>;

const cellClass = ({ right, nowrap, muted, className }: CellProps) =>
  cx(
    styles.cell,
    right && styles.right,
    nowrap && styles.nowrap,
    muted && styles.muted,
    className,
  );

export const Th = (props: CellProps) => (
  <th className={cx(cellClass(props), styles.head)}>{props.children}</th>
);

export const Td = (props: CellProps) => (
  <td className={cellClass(props)}>{props.children}</td>
);
