import { HttpError } from 'http-errors';
import { Prisma } from '@prisma/client';

import { logger } from '../utils/logger.js';

/**
 * Єдина точка перетворення помилки у відповідь.
 * Правило: клієнту — зрозумілий український текст, у лог — подробиці.
 * Деталі внутрішніх помилок у тіло відповіді не кладемо (публічний сервіс).
 */
export const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      status: err.status,
      message: err.message,
      data: err.errors ?? null,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        status: 409,
        message: 'Такий запис уже існує',
        data: { fields: err.meta?.target ?? null },
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        status: 404,
        message: 'Запис не знайдено',
        data: null,
      });
      return;
    }
  }

  logger.error({ err }, 'Необроблена помилка');

  res.status(500).json({
    status: 500,
    message: 'Внутрішня помилка сервера',
    data: null,
  });
};
