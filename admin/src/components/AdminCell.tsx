import type { AdminRole } from '../api';
import { RoleBadge } from './RoleBadge';
import styles from './AdminCell.module.css';

/**
 * Комірка «хто зробив»: логін, роль і (для журналу дій) адреса.
 *
 * Спільна для журналу дій і журналу операцій гостя — обидва відповідають
 * на те саме питання, і виглядати мають однаково.
 */
export const AdminCell = ({
  login,
  role,
  ip = null,
}: {
  login: string;
  role: AdminRole | null;
  ip?: string | null;
}) => (
  <span className={styles.admin}>
    {login}
    <RoleBadge role={role} />
    {ip && <span className={styles.ip}>{ip}</span>}
  </span>
);
