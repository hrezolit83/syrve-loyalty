import type { ReactNode } from 'react';

import { cx } from '../../cx';
import styles from './Table.module.css';

type CellProps = {
  /**
   * Підпис поля для вузького екрана. Там заголовків стовпців немає, і без
   * підпису «130» під «50» не прочитати. Дублює текст відповідного Th.
   */
  label?: string;
  /**
   * Головне поле картки на вузькому екрані: дата й сума. Вони стають у
   * шапку рядка поруч і без підписів — решта полів іде списком нижче.
   */
  primary?: boolean;
  /** Вирівняти вміст по правому краю — для сум. */
  right?: boolean;
  /** Заборонити перенос — для дат, сум і номерів. */
  nowrap?: boolean;
  /** Другорядне значення: приглушений колір. */
  muted?: boolean;
  className?: string;
  children?: ReactNode;
};

/**
 * Таблиця журналу. Вигляд комірок задається пропсами, а не класами ззовні.
 *
 * Нижче 640px та сама розмітка перебудовується в список карток (див.
 * Table.module.css): шість стовпців на телефоні не поміщаються ніяк.
 * Саме тому Td просить label — на вузькому екрані заголовків стовпців
 * немає, і їхню роль беруть підписи полів.
 */
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

const cellClass = ({ right, nowrap, muted, primary, className }: CellProps) =>
  cx(
    styles.cell,
    right && styles.right,
    nowrap && styles.nowrap,
    muted && styles.muted,
    primary && styles.primary,
    className,
  );

export const Th = (props: CellProps) => (
  <th className={cx(cellClass(props), styles.head)}>{props.children}</th>
);

export const Td = (props: CellProps) => (
  <td className={cellClass(props)}>
    {props.label && <span className={styles.label}>{props.label}</span>}
    {/* div, а не span: у комірці дій лежать кнопки в блоковому контейнері,
        і span із блоком усередині — невалідна розмітка. */}
    <div className={styles.value}>{props.children}</div>
  </td>
);
