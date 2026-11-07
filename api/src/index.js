import { initPrismaConnection, closePrismaConnection } from './db/prisma.js';
import { setupServer } from './server.js';
import { logger } from './utils/logger.js';

const bootstrap = async () => {
  try {
    await initPrismaConnection();
    await setupServer();
  } catch (error) {
    logger.error({ err: error }, 'Старт не вдався');
    process.exit(1);
  }
};

// docker compose down надсилає контейнеру SIGTERM. Без обробки процес уб'ють
// жорстко, і пул підключень до PostgreSQL ще якийсь час "висітиме" на боці БД.
const shutdown = async (signal) => {
  logger.info(`${signal}: завершення роботи`);
  await closePrismaConnection();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap();
