// Точка входу ОКРЕМОГО процесу (контейнер worker у docker compose).
// HTTP-порт не слухає. Його робота:
//   - Telegram-бот (long polling) — етап 3;
//   - поллер транзакцій Syrve і черга сповіщень — етап 5.
import { bot, isBotEnabled, startBot } from '../bot/bot.js';
import { closePrismaConnection, initPrismaConnection } from '../db/prisma.js';
import { schedulePolling } from '../queues/pollQueue.js';
import { logger } from '../utils/logger.js';
import { createNotifyWorker } from './notifyWorker.js';
import { createPollWorker } from './pollWorker.js';

const workers = [];

const bootstrap = async () => {
  try {
    // Prisma потрібна воркеру: бот читає й пише гостей, поллер — транзакції.
    await initPrismaConnection();

    await startBot();

    workers.push(createPollWorker());
    logger.info('Воркер поллера слухає чергу "poll"');

    workers.push(createNotifyWorker());
    logger.info('Воркер сповіщень слухає чергу "notify"');

    // Розписання ставимо після воркерів: інакше перша задача могла б
    // з'явитися раніше, ніж буде кому її взяти.
    await schedulePolling();

    logger.info('Воркер запущено');
  } catch (error) {
    logger.error({ err: error }, 'Старт воркера не вдався');
    process.exit(1);
  }
};

// worker.close() дочекається задач, які зараз у роботі: інакше задача
// обірвалася б посередині й зависла в стані active до stalled-таймауту.
const shutdown = async (signal) => {
  logger.info(`${signal}: завершення роботи воркера`);

  try {
    await Promise.all(workers.map((worker) => worker.close()));
    if (isBotEnabled()) await bot.stop();
  } catch (err) {
    logger.error({ err }, 'Помилка під час завершення');
  }

  await closePrismaConnection();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap();
