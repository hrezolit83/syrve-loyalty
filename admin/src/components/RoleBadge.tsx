import type { AdminRole } from '../api';
import { ROLE_LABELS } from '../roles';
import { Badge } from './ui/Badge';

/**
 * Роль адміністратора поруч із логіном.
 *
 * Потрібна в журналах: «admin» і «manager» — просто рядки, і з них не
 * видно, хто мав право на дію, а хто працював у межах ліміту.
 *
 * Бейдж нейтральний для обох ролей: власник — це не «добре», а менеджер
 * не «погано», різницю несе підпис.
 */
export const RoleBadge = ({ role }: { role: AdminRole | null }) => {
  if (!role) return null;

  return <Badge>{ROLE_LABELS[role]}</Badge>;
};
