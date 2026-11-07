import IORedis from 'ioredis';

import { getEnvVar } from '../utils/getEnvVar.js';

const redisOptions = {
  host: getEnvVar('REDIS_HOST', 'localhost'),
  port: Number(getEnvVar('REDIS_PORT', '6379')),
  // Обов'язково для BullMQ: воркер висить на блокуючій команді й чекає
  // задачу. Якщо ioredis обриватиме такий запит після N спроб, BullMQ впаде.
  maxRetriesPerRequest: null,
};

// Одне спільне підключення для всіх Queue (producer-и роблять короткі
// неблокуючі команди, тому можуть ділити сокет).
export const redisConnection = new IORedis(redisOptions);

// Кожному Worker — окреме підключення: він постійно тримає блокуючу
// команду, і спільний сокет заблокував би решту операцій.
export const createRedisConnection = () => new IORedis(redisOptions);
