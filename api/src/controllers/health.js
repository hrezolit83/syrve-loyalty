import { prisma } from '../db/prisma.js';

/** Перевіряє, що застосунок реально бачить PostgreSQL. */
export const getHealthController = async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
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
