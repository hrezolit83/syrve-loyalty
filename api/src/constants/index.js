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

/** Скільки операцій показує бот у кнопці «Історія» (Д1). */
export const HISTORY_LIMIT = 10;

/** Скільки операцій Syrve показує панель на картці гостя (Д1). */
export const ADMIN_HISTORY_LIMIT = 20;

/** Скільки гостей на сторінці списку в панелі (Д2). */
export const GUESTS_PAGE_SIZE = 20;

/**
 * Часовий пояс закладу: у ньому рахуються «сьогодні», доба в графіку й межі
 * періодів. Контейнери живуть у UTC, тому без цього вечірні операції
 * потрапляли б у наступний день.
 */
export const REPORT_TIMEZONE = 'Europe/Kyiv';

/** Межі імені гостя. */
export const GUEST_NAME_MIN = 2;
export const GUEST_NAME_MAX = 50;

/** Cookie з JWT адміністратора. httpOnly, тому JS на сторінці його не бачить. */
export const AUTH_COOKIE = 'syrve_loyalty_token';

/** Скільки живе JWT адміністратора (секунди). */
export const JWT_TTL_SEC = 12 * 60 * 60;

/** Ліміт спроб входу: 10 за хвилину з однієї адреси. */
export const LOGIN_RATE_LIMIT = { limit: 10, windowSec: 60 };

/**
 * Скільки тримаємо транзакцію з локом гостя. Усередині - запити до Syrve,
 * тому дефолтних 5 с Prisma мало.
 */
export const OPERATION_LOCK_TIMEOUT_MS = 30000;

/** Скільки сповіщень за раз виймає outbox. */
export const OUTBOX_BATCH_SIZE = 500;

/** Назви черг BullMQ: на ці рядки спираються і producer, і worker. */
export const QUEUE_NAMES = {
  NOTIFY: 'notify',
  POLL: 'poll',
};

/** Імена задач усередині черг. */
export const JOB_NAMES = {
  NOTIFY_TRANSACTION: 'notify-transaction',
  POLL_TRANSACTIONS: 'poll-transactions',
};

/**
 * Id планувальника повторюваної задачі. Фіксований, тому кожен перезапуск
 * воркера переписує те саме розписання, а не додає ще одне.
 */
export const POLL_SCHEDULER_ID = 'poll-transactions-scheduler';

/** Спільні налаштування повторів: 3 спроби з зростаючою затримкою. */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};
