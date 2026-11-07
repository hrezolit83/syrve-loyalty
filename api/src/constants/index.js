/** Скільки раундів bcrypt для пароля адміністратора. */
export const BCRYPT_ROUNDS = 10;

/** Режими роботи клієнта Syrve. */
export const SYRVE_MODES = {
  REAL: 'real',
  MOCK: 'mock',
};

/**
 * Токен Syrve живе 1 годину. Оновлюємо за 5 хвилин до кінця, щоб запит
 * не впав на межі строку.
 */
export const SYRVE_TOKEN_TTL_MS = 60 * 60 * 1000;
export const SYRVE_TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Таймаут одного HTTP-запиту до Syrve. */
export const SYRVE_REQUEST_TIMEOUT_MS = 15000;

/** Назви черг BullMQ: на ці рядки спираються і producer, і worker. */
export const QUEUE_NAMES = {
  NOTIFY: 'notify',
};

/** Імена задач усередині черг. */
export const JOB_NAMES = {
  NOTIFY_TRANSACTION: 'notify-transaction',
  POLL_TRANSACTIONS: 'poll-transactions',
};

/** Спільні налаштування повторів: 3 спроби з зростаючою затримкою. */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};
