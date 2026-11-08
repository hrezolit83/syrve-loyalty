import { OUTBOX_BATCH_SIZE } from '../constants/index.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { getSyrveClient } from './syrve/index.js';
import {
  fetchTransactionsFrom,
  keepProgramTransactions,
  toProcessedRow,
} from './transactionFeed.js';

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

/**
 * Один прохід по гостю: прочитати нові транзакції, записати їх і зсунути
 * курсор одним комітом.
 *
 * @returns {Promise<number>} скільки нових транзакцій записано
 */
export const syncGuestTransactions = async (guest) => {
  const { transactions, lastRevision } = await fetchTransactionsFrom(
    guest.syrveCustomerId,
    guest.lastRevision,
  );

  if (transactions.length === 0) return 0;

  const program = await getSyrveClient().getProgram();

  // Фільтр перед записом — спільний із бекфілом історії: чужі гаманці й
  // транзакції, які не змінюють баланс (див. transactionFeed.js).
  const relevant = keepProgramTransactions(transactions, program.walletId);

  // Курсор зсуваємо однаково — і коли все відфільтрували: інакше наступний
  // прохід читав би ті самі непотрібні транзакції вічно.
  const inserted = await prisma.$transaction(async (tx) => {
    const result =
      relevant.length > 0
        ? await tx.processedTransaction.createMany({
            // Час береться з Syrve, а не наш: поллер бачить транзакцію із
            // затримкою до POLL_INTERVAL_SEC, а в журналі панелі має стояти
            // момент самої операції.
            data: relevant.map((item) => toProcessedRow(item, guest.id)),
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
