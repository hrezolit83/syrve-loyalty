import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { resolvePeriod } from '../utils/period.js';

/**
 * Журнал дій адміністраторів (Д10).
 *
 * Пишеться лише з коду. API на зміну чи видалення запису немає й не буде:
 * журнал, з якого можна прибрати рядок, не журнал.
 *
 * Запис ніколи не ламає саму дію. Якщо вставка впала (база недоступна,
 * поле не влізло), помилка йде в лог сервера, а операція, яку
 * адміністратор щойно зробив, лишається виконаною. Протилежний вибір —
 * відкочувати нарахування через збій журналу — гірший.
 */
export const writeAuditLog = async ({
  admin,
  login,
  action,
  targetType = null,
  targetId = null,
  details = null,
  ip = null,
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: admin?.id ?? null,
        // Логін беремо з адміністратора, а для невдалого входу — із того,
        // що ввели у формі: саме він і цікавий у такому записі.
        adminLogin: admin?.login ?? login ?? '—',
        action,
        targetType,
        targetId,
        details,
        ip,
      },
    });
  } catch (error) {
    logger.error({ err: error, action }, 'Не вдалося записати в журнал дій');
  }
};

/**
 * IP того, хто робить запит. За nginx справжню адресу дає X-Forwarded-For.
 *
 * Node віддає IPv4 у вигляді ::ffff:172.19.0.1 — це та сама адреса в
 * IPv6-обгортці. У журналі префікс лише заважає читати.
 */
export const requestIp = (req) =>
  req.ip ? req.ip.replace(/^::ffff:/, '') : null;

/** Сторінка журналу з фільтрами: хто, яка дія, за який період. */
export const getAuditLog = async ({ adminId, action, period, page, pageSize }) => {
  const { from, to } = resolvePeriod(period);

  const where = {
    ...(from ? { createdAt: { gte: from, lte: to } } : {}),
    ...(adminId ? { adminId } : {}),
    ...(action ? { action } : {}),
  };

  const [total, entries] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      // Роль беремо з адміністратора, а не з запису: у журналі лежить
      // факт дії, а роль — поточний стан. Якщо адміністратора вже немає
      // (або це був невдалий вхід під невідомим логіном), ролі теж немає.
      include: { admin: { select: { role: true } } },
    }),
  ]);

  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      adminId: entry.adminId,
      adminLogin: entry.adminLogin,
      adminRole: entry.admin?.role ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      details: entry.details,
      ip: entry.ip,
      createdAt: entry.createdAt,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
};
