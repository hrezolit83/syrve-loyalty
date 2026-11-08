import { prisma } from '../db/prisma.js';
import { formatPhone } from '../utils/phone.js';
import { resolvePeriod } from '../utils/period.js';

/**
 * Журнал транзакцій усіх наших гостей.
 *
 * Читається з `processed_transactions` — того ж джерела, що й статистика
 * (Д9) і сповіщення (О6). Там лежать транзакції гаманця НАШОЇ програми:
 * поллер відсіює чужі гаманці ще до запису.
 *
 * Чому не з Syrve напряму: метод `by_revision` працює для одного гостя,
 * тому «усі транзакції закладу» довелося б збирати N запитами на кожне
 * відкриття сторінки. Поллер уже приніс ці дані до нас — сторінка їх і бере.
 * Наслідок, який треба знати: тут видно лише транзакції гостей,
 * зареєстрованих через бот, бо решту сервіс не опитує.
 */

/** Коди й назви типів, якими Syrve позначає операції через API. */
const API_TYPE_CODES = new Set(['35', '40']);

/**
 * Звідки операція.
 *
 * Syrve не каже, який саме клієнт API зробив запис, тому «панель» означає
 * «через API» — наша панель єдина, хто ходить у цю програму через API.
 * Решта (каса, кабінет Syrve Loyalty) приходить іншими типами.
 */
const resolveSource = ({ type, typeName }) => {
  if (typeName?.endsWith('FromApi')) return 'panel';
  if (API_TYPE_CODES.has(String(type))) return 'panel';

  return 'syrve';
};

const buildWhere = ({ period, type }) => {
  const { from, to } = resolvePeriod(period);

  const where = {};

  if (from) where.createdAt = { gte: from, lte: to };

  // Напрямок — за знаком суми, як і скрізь у сервісі.
  if (type === 'topup') where.sum = { gt: 0 };
  if (type === 'chargeoff') where.sum = { lt: 0 };

  return where;
};

const toRow = (item) => ({
  id: item.id,
  transactionId: item.transactionId,
  // whenCreated — час операції в Syrve; createdAt — коли її побачив поллер.
  // Рядки, записані до появи колонки, whenCreated не мають.
  date: item.whenCreated ?? item.createdAt,
  sum: Number(item.sum),
  balanceAfter: item.balanceAfter === null ? null : Number(item.balanceAfter),
  comment: item.comment,
  type: item.type,
  typeName: item.typeName,
  source: resolveSource(item),
  guest: {
    id: item.guest.id,
    customerId: item.guest.syrveCustomerId,
    name: item.guest.name,
    phoneFormatted: formatPhone(item.guest.phone),
  },
});

const GUEST_SELECT = {
  select: { id: true, name: true, phone: true, syrveCustomerId: true },
};

export const getTransactions = async ({ period, type, page, pageSize }) => {
  const where = buildWhere({ period, type });

  const [total, items] = await prisma.$transaction([
    prisma.processedTransaction.count({ where }),
    prisma.processedTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { guest: GUEST_SELECT },
    }),
  ]);

  return {
    transactions: items.map(toRow),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
};

/** Ті самі рядки без пагінації — для експорту. */
export const getTransactionsForExport = async ({ period, type, limit }) => {
  const items = await prisma.processedTransaction.findMany({
    where: buildWhere({ period, type }),
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { guest: GUEST_SELECT },
  });

  return items.map(toRow);
};
