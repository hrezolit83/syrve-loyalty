import { Queue } from 'bullmq';

import {
  JOB_NAMES,
  POLL_SCHEDULER_ID,
  QUEUE_NAMES,
} from '../constants/index.js';
import { getEnvVar } from '../utils/getEnvVar.js';
import { logger } from '../utils/logger.js';
import { redisConnection } from './connection.js';

export const pollQueue = new Queue(QUEUE_NAMES.POLL, {
  connection: redisConnection,
  defaultJobOptions: {
    // Прохід поллера повторюється кожні POLL_INTERVAL_SEC, тому ретраї йому
    // не потрібні: наступний запуск однаково прочитає те саме з курсора.
    attempts: 1,
    removeOnComplete: 20,
    removeOnFail: 50,
  },
});

/**
 * Один планувальник на всю систему: фіксований id, тому скільки б воркерів
 * не піднялося, розписання буде одне й те саме, а не N паралельних проходів.
 */
export const schedulePolling = async () => {
  const intervalSec = Number(getEnvVar('POLL_INTERVAL_SEC', '30'));

  await pollQueue.upsertJobScheduler(
    POLL_SCHEDULER_ID,
    { every: intervalSec * 1000 },
    { name: JOB_NAMES.POLL_TRANSACTIONS, data: {} },
  );

  logger.info(`Поллер транзакцій: кожні ${intervalSec} с`);
};
