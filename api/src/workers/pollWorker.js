import { Worker } from 'bullmq';

import { JOB_NAMES, QUEUE_NAMES } from '../constants/index.js';
import { addNotifyJob } from '../queues/notifyQueue.js';
import { createRedisConnection } from '../queues/connection.js';
import {
  enqueuePendingNotifications,
  getGuestsToPoll,
  syncGuestTransactions,
} from '../services/transactionSync.js';
import { logger } from '../utils/logger.js';

/**
 * Поллер транзакцій (О6).
 *
 * concurrency: 1 — проходи не мають накладатися один на одний: два одночасні
 * читання того самого курсора зробили б подвійну роботу.
 *
 * Помилка на одному гостю не зриває весь прохід: Syrve міг не відповісти
 * саме про нього, а решту гостей треба обробити.
 */
export const createPollWorker = () => {
  const worker = new Worker(
    QUEUE_NAMES.POLL,
    async (job) => {
      if (job.name !== JOB_NAMES.POLL_TRANSACTIONS) {
        throw new Error(`Невідома задача: ${job.name}`);
      }

      const guests = await getGuestsToPoll();

      let newTransactions = 0;
      let failed = 0;

      for (const guest of guests) {
        try {
          newTransactions += await syncGuestTransactions(guest);
        } catch (error) {
          failed += 1;
          logger.error(
            {
              guestId: guest.id,
              err: { name: error.name, message: error.message },
              correlationId: error.correlationId ?? null,
            },
            'Не вдалося синхронізувати транзакції гостя',
          );
        }
      }

      // Outbox після всіх комітів: беремо з БД усе неоповіщене, зокрема те,
      // що зависло з минулих проходів.
      const queued = await enqueuePendingNotifications(addNotifyJob);

      return { гостей: guests.length, нових: newTransactions, у_черзі: queued, помилок: failed };
    },
    {
      connection: createRedisConnection(),
      concurrency: 1,
    },
  );

  // Лог кожного проходу: без нього не видно, чи розклад узагалі тікає —
  // при тихій базі синхронізація нічого не пише.
  worker.on('completed', (job, result) => {
    logger.debug({ jobId: job.id, ...result }, 'Прохід поллера завершено');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Прохід поллера впав');
  });

  return worker;
};
