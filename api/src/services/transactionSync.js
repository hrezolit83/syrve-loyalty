import {
  OUTBOX_BATCH_SIZE,
  TRANSACTIONS_PAGE_SIZE,
} from '../constants/index.js';
import { isNotifiable } from '../constants/transactionTypes.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { getSyrveClient } from './syrve/index.js';

/**
 * Синхронізація транзакцій Syrve (О6).
 *
 * Syrve не надсилає вебхуків про зміну балансу, тому нові транзакції
 * доводиться періодично питати самим: customer/transactions/by_revision.
 * Метод працює для ОДНОГО гостя, тому курсор revision зберігається окремо
 * для кожного (Guest.lastRevision).
 *
 * Надійність тримається на трьох речах:
 *
 * 1. Один коміт БД. Вставка нових ProcessedTransaction і зсув курсора
 *    Guest.lastRevision — в одній транзакції. Інакше можливі два лиха:
 *    курсор зсунувся, а записів немає (сповіщення втрачено назавжди), або
 *    записи є, а курсор ні (наступний прохід прочитає те саме).
 *
 * 2. Unique на transactionId + skipDuplicates. Навіть якщо та сама транзакція
 *    прийде двічі, другий рядок не з'явиться.
 *
 * 3. Outbox. У чергу сповіщень кладемо не те, що прочитали з Syrve, а те, що
 *    вже лежить у БД із notifiedAt IS NULL. Якщо процес упав між комітом і
 *    постановкою в чергу, наступний прохід усе одно підбере ці записи.
 *    jobId = transactionId, тому BullMQ відкидає дублі задач.
 */

/** Читає нові транзакції гостя сторінками й повертає їх усі. */
const fetchNewTransactions = async (customerId, fromRevision) => {
  const client = getSyrveClient();

  const collected = [];
  let cursor = Number(fromRevision);

  for (;;) {
    const { transactions, lastRevision } =
      await client.getTransactionsByRevision({
        customerId,
        revision: cursor,
        pageSize: TRANSACTIONS_PAGE_SIZE,
      });

    if (transactions.length === 0) break;

    collected.push(...transactions);

    const maxRevision = Math.max(
      lastRevision ?? 0,
      ...transactions.map((item) => item.revision),
    );

    // Якщо Syrve повернув ту саму сторінку, виходимо: інакше вічний цикл.
    if (maxRevision <= cursor) break;

    cursor = maxRevision;

    if (transactions.length < TRANSACTIONS_PAGE_SIZE) break;
  }

  return { transactions: collected, lastRevision: cursor };
};

/**
 * Один прохід по гостю: прочитати нові транзакції, записати їх і зсунути
 * курсор одним комітом.
 *
 * @returns {Promise<number>} скільки нових транзакцій записано
 */
export const syncGuestTransactions = async (guest) => {
  const { transactions, lastRevision } = await fetchNewTransactions(
    guest.syrveCustomerId,
    guest.lastRevision,
  );

  if (transactions.length === 0) return 0;

  const program = await getSyrveClient().getProgram();

  // Фільтр перед записом. Два відсіювання, обидва з живих даних:
  //
  // 1. Чужий гаманець. Гість може бути в кількох програмах (у тестовій
  //    організації їх чотири), і by_revision віддає транзакції всіх.
  //    Нам потрібні лише ті, що стосуються гаманця НАШОЇ програми —
  //    інакше гість отримав би "баланс" від чужої програми.
  //
  // 2. Транзакції, які не змінюють баланс: SetGuestCategory приходить із
  //    sum = 0 і balanceAfter = null. Писати про неї гостю нема про що.
  const relevant = transactions.filter((item) => {
    if (item.walletId && item.walletId !== program.walletId) return false;

    return isNotifiable(item);
  });

  // Курсор зсуваємо однаково — і коли все відфільтрували: інакше наступний
  // прохід читав би ті самі непотрібні транзакції вічно.
  const inserted = await prisma.$transaction(async (tx) => {
    const result =
      relevant.length > 0
        ? await tx.processedTransaction.createMany({
            data: relevant.map((item) => ({
              transactionId: String(item.id),
              guestId: guest.id,
              revision: BigInt(item.revision),
              type: String(item.type ?? 'unknown'),
              typeName: item.typeName ?? null,
              sum: item.sum,
              balanceAfter: item.balanceAfter,
            })),
            // Той самий transactionId удруге не вставиться:
            // unique + skipDuplicates.
            skipDuplicates: true,
          })
        : { count: 0 };

    await tx.guest.update({
      where: { id: guest.id },
      data: { lastRevision: BigInt(lastRevision) },
    });

    return result.count;
  });

  logger.info(
    {
      guestId: guest.id,
      прочитано: transactions.length,
      доРечі: relevant.length,
      нових: inserted,
      lastRevision,
    },
    'Синхронізовано транзакції гостя',
  );

  return inserted;
};

/**
 * Outbox: усе, що лежить у БД без відправленого сповіщення, кладемо в чергу.
 *
 * Викликається ПІСЛЯ комітів синхронізації. Повторний виклик безпечний:
 * jobId = transactionId, а воркер ще раз перевіряє notifiedAt.
 */
export const enqueuePendingNotifications = async (addNotifyJob) => {
  const pending = await prisma.processedTransaction.findMany({
    where: {
      notifiedAt: null,
      // Заблокованим ботом не пишемо — Telegram усе одно відмовить.
      guest: { botBlockedAt: null },
    },
    orderBy: { createdAt: 'asc' },
    take: OUTBOX_BATCH_SIZE,
    select: { transactionId: true },
  });

  for (const row of pending) {
    await addNotifyJob({ transactionId: row.transactionId });
  }

  if (pending.length > 0) {
    logger.info({ кількість: pending.length }, 'Поставлено сповіщення в чергу');
  }

  return pending.length;
};

/** Гості, яких має сенс опитувати: є гість у Syrve і бот не заблокований. */
export const getGuestsToPoll = async () =>
  prisma.guest.findMany({
    where: {
      syrveCustomerId: { not: null },
      botBlockedAt: null,
    },
    select: {
      id: true,
      syrveCustomerId: true,
      lastRevision: true,
      chatId: true,
    },
  });
