import { BOT_STATE_TTL_SEC } from '../constants/index.js';
import { redisConnection } from '../queues/connection.js';

/**
 * Стан діалогу реєстрації.
 *
 * У Redis, а не в пам'яті процесу: воркер перезапускається (деплой, падіння,
 * docker compose restart), і гість, який уже надіслав контакт, не має починати
 * з нуля. TTL годину — якщо діалог покинули, сміття саме зникне.
 */
const key = (telegramId) => `bot:state:${telegramId}`;

export const STEPS = {
  AWAITING_CONTACT: 'awaiting_contact',
  AWAITING_NAME: 'awaiting_name',
};

export const getState = async (telegramId) => {
  const raw = await redisConnection.get(key(telegramId));

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setState = async (telegramId, state) => {
  await redisConnection.set(
    key(telegramId),
    JSON.stringify(state),
    'EX',
    BOT_STATE_TTL_SEC,
  );
};

export const clearState = async (telegramId) => {
  await redisConnection.del(key(telegramId));
};
