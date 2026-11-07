import { UnrecoverableError, Worker } from 'bullmq';

import { bot } from '../bot/bot.js';
import { JOB_NAMES, QUEUE_NAMES } from '../constants/index.js';
import {
  classifyTransaction,
  TRANSACTION_KINDS,
} from '../constants/transactionTypes.js';
import { prisma } from '../db/prisma.js';
import { createRedisConnection } from '../queues/connection.js';
import { MESSAGES } from '../templates/messages.js';
import { logger } from '../utils/logger.js';

/**
 * Відправка сповіщень гостю (О6).
 *
 * Правило «одна операція — одне повідомлення» тримається на двох перевірках:
 *   - jobId = transactionId, тому BullMQ не створює другу задачу;
 *   - notifiedAt у БД: навіть якщо задача прийшла вдруге (ретрай, перезапуск,
 *     витіснення старих задач із Redis), повідомлення не піде повторно.
 *
 * notifiedAt ставимо ПІСЛЯ успішної відправки. Якщо помітити раніше й
 * відправка впаде, гість не дізнається про бонуси зовсім — а зайве
 * повідомлення менша біда, ніж загублене. Але до зайвого й не доходить:
 * ретрай перевіряє notifiedAt.
 */

/** Telegram: 403 — бота заблокували або чат видалено. Ретраї не допоможуть. */
const isBlockedByUser = (error) =>
  error?.error_code === 403 ||
  /blocked|bot was kicked|chat not found|user is deactivated/i.test(
    error?.description ?? error?.message ?? '',
  );

const buildMessage = (transaction) => {
  const kind = classifyTransaction({
    type: transaction.type,
    typeName: transaction.typeName,
    sum: Number(transaction.sum),
  });

  const payload = {
    // Знак у тексті не потрібен: про напрям говорить саме формулювання.
    sum: Math.abs(Number(transaction.sum)),
    // balanceAfter у Syrve буває null — тоді рядок про баланс не пишемо,
    // замість "Баланс: 0", який був би неправдою.
    balanceAfter:
      transaction.balanceAfter === null
        ? null
        : Number(transaction.balanceAfter),
    comment: null,
  };

  return kind === TRANSACTION_KINDS.CHARGEOFF
    ? MESSAGES.notifyChargeOff(payload)
    : MESSAGES.notifyTopUp(payload);
};

export const createNotifyWorker = () => {
  const worker = new Worker(
    QUEUE_NAMES.NOTIFY,
    async (job) => {
      if (job.name !== JOB_NAMES.NOTIFY_TRANSACTION) {
        throw new Error(`Невідома задача: ${job.name}`);
      }

      const { transactionId } = job.data;

      const transaction = await prisma.processedTransaction.findUnique({
        where: { transactionId },
        include: { guest: true },
      });

      if (!transaction) {
        // Запис зник (ручне чищення БД) — повторювати нічого.
        throw new UnrecoverableError(
          `Транзакції ${transactionId} немає в базі`,
        );
      }

      // Головна перевірка на дубль.
      if (transaction.notifiedAt) {
        logger.debug({ transactionId }, 'Сповіщення вже надіслано, пропускаю');
        return { skipped: true };
      }

      if (transaction.guest.botBlockedAt) {
        throw new UnrecoverableError('Гість заблокував бота');
      }

      const chatId = transaction.guest.chatId.toString();

      try {
        await bot.api.sendMessage(chatId, buildMessage(transaction));
      } catch (error) {
        if (isBlockedByUser(error)) {
          // Позначаємо гостя й знімаємо задачу: писати йому більше не треба.
          await prisma.guest.update({
            where: { id: transaction.guestId },
            data: { botBlockedAt: new Date() },
          });

          await prisma.processedTransaction.update({
            where: { transactionId },
            data: { notifyError: 'Гість заблокував бота' },
          });

          logger.warn(
            { guestId: transaction.guestId },
            'Гість заблокував бота — сповіщення припинено',
          );

          throw new UnrecoverableError('Гість заблокував бота');
        }

        await prisma.processedTransaction.update({
          where: { transactionId },
          data: { notifyError: error.message?.slice(0, 500) ?? 'помилка' },
        });

        // Решта помилок (мережа, 429, 5xx) — звичайний ретрай із backoff.
        throw error;
      }

      await prisma.processedTransaction.update({
        where: { transactionId },
        data: { notifiedAt: new Date(), notifyError: null },
      });

      logger.info({ transactionId, chatId }, 'Сповіщення надіслано');

      return { sent: true };
    },
    {
      connection: createRedisConnection(),
      concurrency: 5,
      // Telegram Bot API має ліміт ~30 повідомлень на секунду.
      limiter: { max: 20, duration: 1000 },
    },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        attempt: `${job?.attemptsMade}/${job?.opts.attempts}`,
        err: err.message,
      },
      'Сповіщення не надіслано',
    );
  });

  return worker;
};
