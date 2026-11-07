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

/** Довжина номера картки: 10 цифр, узгоджено з роботодавцем. track = number. */
export const CARD_NUMBER_LENGTH = 10;

/** Скільки разів пробуємо новий номер картки, якщо Syrve скаже "вже існує". */
export const CARD_NUMBER_MAX_ATTEMPTS = 5;

/** Розмір сторінки при читанні транзакцій гостя. */
export const TRANSACTIONS_PAGE_SIZE = 100;

/** Скільки живе незавершений діалог реєстрації в Redis. */
export const BOT_STATE_TTL_SEC = 60 * 60;

/** Межі імені гостя. */
export const GUEST_NAME_MIN = 2;
export const GUEST_NAME_MAX = 50;

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
