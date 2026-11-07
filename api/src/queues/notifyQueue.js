import { Queue } from 'bullmq';

import {
  DEFAULT_JOB_OPTIONS,
  JOB_NAMES,
  QUEUE_NAMES,
} from '../constants/index.js';
import { redisConnection } from './connection.js';

export const notifyQueue = new Queue(QUEUE_NAMES.NOTIFY, {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Ставить сповіщення про одну транзакцію.
 *
 * jobId = transactionId — головний захист від дубля: BullMQ не додасть другу
 * задачу з таким самим id, поки перша ще зберігається в Redis.
 */
export const addNotifyJob = async ({ transactionId }) =>
  notifyQueue.add(
    JOB_NAMES.NOTIFY_TRANSACTION,
    { transactionId },
    { jobId: transactionId },
  );
