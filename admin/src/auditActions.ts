import type { AuditAction } from './api';

/**
 * Підписи дій українською.
 *
 * Живуть у панелі, а не в API: у базі лежать стабільні коди, які не мають
 * мінятися через правку формулювання.
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'auth.login': 'Вхід',
  'auth.login_failed': 'Невдалий вхід',
  'auth.logout': 'Вихід',
  'operation.topup': 'Нарахування',
  'operation.chargeoff': 'Списання',
  'admin.create': 'Створено адміністратора',
  'admin.update': 'Змінено адміністратора',
  'admin.deactivate': 'Вимкнено доступ',
  'admin.password_reset': 'Скинуто пароль',
  'transactions.export': 'Експорт CSV',
};

/** Порядок у фільтрі: спершу вхід, далі операції, далі адміністрування. */
export const AUDIT_ACTION_ORDER: AuditAction[] = [
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'operation.topup',
  'operation.chargeoff',
  'admin.create',
  'admin.update',
  'admin.deactivate',
  'admin.password_reset',
  'transactions.export',
];

/**
 * Деталі запису одним рядком.
 *
 * Показуємо саме те, що записав сервер, без спроб домалювати зміст:
 * журнал цінний тим, що в ньому видно факти.
 */
export const formatAuditDetails = (
  details: Record<string, unknown> | null,
): string => {
  if (!details) return '—';

  const parts = Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${String(value)}`);

  return parts.length > 0 ? parts.join(', ') : '—';
};
