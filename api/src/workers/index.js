// Точка входу ОКРЕМОГО процесу (контейнер worker у docker compose).
// HTTP-порт не слухає. Його робота: Telegram-бот (long polling),
// поллер транзакцій Syrve і черга сповіщень.
//
// Етап 1 — лише каркас і коректне завершення; бот і поллер додаються
// на етапах 3 і 5.
import { initPrismaConnection, closePrismaConnection } from '../db/prisma.js';
import { logger } from '../utils/logger.js';

const workers = [];

const bootstrap = async () => {
  try {
    await initPrismaConnection();
    logger.info('Воркер запущено (черги й бот додаються на етапах 3 і 5)');
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
  } catch (err) {
    logger.error({ err }, 'Помилка під час завершення');
  }

  await closePrismaConnection();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap();
