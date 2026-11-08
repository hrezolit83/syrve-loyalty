import type { ReactNode } from 'react';

import styles from './FormRow.module.css';

/**
 * Рядок форми: поля поруч, із переносом на вузькому екрані.
 *
 * Підказка стоїть під усім рядом, а не всередині поля, і це не дрібниця
 * оформлення. Кнопка в ряду вирівняна по нижньому краю (у полів зверху ще
 * є підпис), тож підказка всередині поля робила б його вищим — і кнопка
 * з'їжджала б нижче за input, на рівень підказки.
 *
 * hintId передається ззовні, щоб поле могло послатися на підказку через
 * aria-describedby: інакше скрінрідер прочитав би підпис і не сказав, що
 * саме сюди можна ввести.
 */
export const FormRow = ({
  hint,
  hintId,
  children,
}: {
  hint?: ReactNode;
  hintId?: string;
  children: ReactNode;
}) => (
  <div className={styles.group}>
    <div className={styles.row}>{children}</div>
    {hint && (
      <p className={styles.hint} id={hintId}>
        {hint}
      </p>
    )}
  </div>
);
