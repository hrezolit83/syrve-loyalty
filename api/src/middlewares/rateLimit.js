import createHttpError from 'http-errors';

import { redisConnection } from '../queues/connection.js';
import { logger } from '../utils/logger.js';

/**
 * Простий лімітер за IP на Redis.
 *
 * Чому Redis, а не Map у пам'яті: процесів api може бути кілька, і лічильник
 * у пам'яті обходиться простим чергуванням запитів між ними.
 * Якщо Redis недоступний — пускаємо запит далі: лімітер не має валити вхід.
 */
export const rateLimit = ({ keyPrefix, limit, windowSec }) =>
  async function rateLimitMiddleware(req, res, next) {
    const ip = req.ip ?? 'unknown';
    const key = `rl:${keyPrefix}:${ip}`;

    try {
      const count = await redisConnection.incr(key);

      // EXPIRE лише на першому запиті вікна, інакше вікно нескінченно
      // подовжувалося б з кожною спробою.
      if (count === 1) await redisConnection.expire(key, windowSec);

      if (count > limit) {
        const ttl = await redisConnection.ttl(key);

        logger.warn({ ip, keyPrefix, count }, 'Перевищено ліміт запитів');

        next(
          createHttpError(
            429,
            `Занадто багато спроб. Спробуйте за ${ttl > 0 ? ttl : windowSec} с`,
          ),
        );
        return;
      }
    } catch (err) {
      logger.error({ err }, 'Лімітер недоступний, пропускаю запит');
    }

    next();
  };
