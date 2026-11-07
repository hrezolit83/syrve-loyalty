import { prisma } from '../db/prisma.js';
import { getSyrveClient, SyrveError } from '../services/syrve/index.js';
import { logger } from '../utils/logger.js';

/** Перевіряє, що застосунок реально бачить PostgreSQL. */
export const getHealthController = async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    res.status(503).json({
      status: 503,
      message: 'База даних недоступна',
      data: { database: 'down' },
    });
    return;
  }

  res.json({
    status: 200,
    message: 'ok',
    data: { database: 'up' },
  });
};

/**
 * О1: токен отримано, організацію й програму знайдено.
 *
 * Токен у відповідь НЕ потрапляє — лише факт, що він є. Так ендпоінт можна
 * показувати на демонстрації й не світити ключ.
 */
export const getSyrveHealthController = async (req, res) => {
  const client = getSyrveClient();

  try {
    const result = await client.checkConnection();

    res.json({
      status: 200,
      message: 'Підключення до Syrve працює',
      data: {
        mode: result.mode,
        token: result.tokenStatus,
        organization: result.organization,
        program: result.program,
      },
    });
  } catch (error) {
    // Деталі — у лог, клієнтові — зрозумілий текст і correlationId Syrve.
    logger.error(
      {
        err: { name: error.name, message: error.message },
        status: error.status ?? null,
        correlationId: error.correlationId ?? null,
      },
      'Syrve: перевірка підключення не вдалася',
    );

    res.status(503).json({
      status: 503,
      message:
        error instanceof SyrveError
          ? error.message
          : 'Не вдалося підключитися до Syrve',
      data: {
        mode: client.mode,
        error: error.name,
        correlationId: error.correlationId ?? null,
      },
    });
  }
};
