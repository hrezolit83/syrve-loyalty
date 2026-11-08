import { prisma } from '../db/prisma.js';
import { CARD_NUMBER_MAX_ATTEMPTS } from '../constants/index.js';
import { generateCardNumber } from '../utils/cardNumber.js';
import { logger } from '../utils/logger.js';
import { backfillGuestHistory } from './backfill.js';
import {
  getSyrveClient,
  SyrveValidationError,
} from './syrve/index.js';

/**
 * Гості: реєстрація в Syrve Loyalty і зв'язка з Telegram-акаунтом.
 *
 * Межа відповідальності: ім'я, картка й баланс належать Syrve, тут лише
 * зв'язок telegramId ↔ syrveCustomerId і курсор синхронізації транзакцій.
 */

/** Текст Syrve на повторне додавання в програму. Один раз і в одному місці. */
const ALREADY_IN_PROGRAM = /already|exists|уже|вже|дублик/i;
const CARD_CONFLICT = /already|exists|занят|уже|вже|duplicate/i;

export const findGuestByTelegramId = async (telegramId) =>
  prisma.guest.findUnique({ where: { telegramId: BigInt(telegramId) } });

export const findGuestByCustomerId = async (syrveCustomerId) =>
  prisma.guest.findUnique({ where: { syrveCustomerId } });

/**
 * Коли гість з'явився в Syrve.
 *
 * Потрібно статистиці: «нові реєстрації» мають рахуватися від появи гостя
 * в програмі, а не від моменту, коли він відкрив нашого бота — на касі його
 * могли завести значно раніше.
 *
 * Для знайденого гостя дата вже в руках, для щойно створеного доводиться
 * перечитати картку: create_or_update повертає тільки id.
 */
const resolveWhenRegistered = async (existingCustomer, customerId) => {
  const raw =
    existingCustomer?.whenRegistered ??
    (await getSyrveClient().findCustomerById(customerId))?.whenRegistered;

  return raw ? new Date(raw) : null;
};

/** Додає гостя в програму. "Вже в програмі" — це успіх, а не помилка. */
const ensureInProgram = async (customerId) => {
  const client = getSyrveClient();

  try {
    await client.addCustomerToProgram(customerId);
  } catch (error) {
    if (
      error instanceof SyrveValidationError &&
      ALREADY_IN_PROGRAM.test(error.details ?? '')
    ) {
      logger.info({ customerId }, 'Гість уже в програмі лояльності');
      return;
    }

    throw error;
  }
};

/**
 * Видає картку, якщо її ще немає. При конфлікті номера пробує новий:
 * номер генерується випадково, тому збіг можливий.
 */
const ensureCard = async (customerId, existingCards = []) => {
  const existing = existingCards.find((card) => card.number || card.track);

  if (existing) return existing.number ?? existing.track;

  const client = getSyrveClient();

  for (let attempt = 1; attempt <= CARD_NUMBER_MAX_ATTEMPTS; attempt += 1) {
    const cardNumber = generateCardNumber();

    try {
      // track = number: узгоджено з роботодавцем.
      await client.addCard({ customerId, cardNumber, cardTrack: cardNumber });
      return cardNumber;
    } catch (error) {
      const isConflict =
        error instanceof SyrveValidationError &&
        CARD_CONFLICT.test(error.details ?? '');

      if (!isConflict || attempt === CARD_NUMBER_MAX_ATTEMPTS) throw error;

      logger.warn(
        { customerId, attempt },
        'Номер картки зайнятий, пробую інший',
      );
    }
  }

  // Недосяжно: цикл або повертає номер, або кидає помилку.
  throw new Error('Не вдалося видати картку');
};

/**
 * Реєстрація гостя — ідемпотентна.
 *
 * Порядок саме такий:
 *  1. шукаємо гостя в Syrve за телефоном — якщо він там уже є (приходив на
 *     касу раніше), беремо його id і наявну картку, нового не створюємо;
 *  2. створюємо, лише якщо не знайшли;
 *  3. додаємо в програму (повторне додавання — не помилка);
 *  4. видаємо картку, лише якщо карток немає;
 *  5. зберігаємо зв'язок із Telegram;
 *  6. бекфілимо історію: усі минулі транзакції гаманця нашої програми
 *     лягають у базу як historical із уже проставленим notifiedAt, а курсор
 *     стає на останню ревізію.
 *
 * Крок 6 раніше був просто «запам'ятати останню ревізію». Сповіщень про
 * старі операції так теж не було, але разом із ними зникала й історія:
 * статистика (Д9) і журнал транзакцій не бачили нічого, що сталося до
 * підключення бота. Тепер історія зберігається, а мовчання забезпечує
 * notifiedAt, а не пропуск даних.
 *
 * Повторний /start того самого телефону з іншого Telegram-акаунта не створює
 * ні другого гостя в Syrve, ні другого рядка в guests: рядок переприв'язується
 * до нового telegramId (номер підтверджений Telegram, тож це той самий власник).
 */
export const registerGuest = async ({ telegramId, chatId, phone, name }) => {
  const client = getSyrveClient();

  const existingCustomer = await client.findCustomerByPhone(phone);

  let customerId;
  let cards = [];

  if (existingCustomer) {
    customerId = existingCustomer.id;
    cards = existingCustomer.cards ?? [];

    logger.info({ customerId }, 'Гість уже існує в Syrve — використовую його');

    // Ім'я в Syrve не перезаписуємо, якщо воно вже заповнене: там може бути
    // дані, які внесли на касі. Заповнюємо лише порожнє.
    if (!existingCustomer.name) {
      await client.createOrUpdateCustomer({ phone, name });
    }
  } else {
    customerId = await client.createOrUpdateCustomer({ phone, name });
    logger.info({ customerId }, 'Створено гостя в Syrve');
  }

  await ensureInProgram(customerId);

  const cardNumber = await ensureCard(customerId, cards);

  const whenRegistered = await resolveWhenRegistered(
    existingCustomer,
    customerId,
  );

  const link = {
    chatId: BigInt(chatId),
    name,
    syrveCustomerId: customerId,
    cardNumber,
    whenRegistered,
  };

  // Переприв'язка: якщо цей телефон уже є в нашій базі (інший Telegram),
  // переносимо рядок на новий акаунт — історія операцій гостя зберігається.
  const byPhone = await prisma.guest.findUnique({ where: { phone } });

  let guest;

  if (byPhone && byPhone.telegramId !== BigInt(telegramId)) {
    logger.warn(
      { guestId: byPhone.id },
      'Телефон уже зареєстрований з іншого Telegram — переприв\'язую',
    );

    guest = await prisma.guest.update({
      where: { id: byPhone.id },
      data: { ...link, telegramId: BigInt(telegramId) },
    });
  } else {
    guest = await prisma.guest.upsert({
      where: { telegramId: BigInt(telegramId) },
      update: { ...link, phone },
      create: { ...link, telegramId: BigInt(telegramId), phone },
    });
  }

  // Бекфіл після збереження рядка: транзакції посилаються на guest.id.
  await backfillGuestHistory(guest);

  // Курсор зсунув бекфіл — повертаємо свіжий рядок, а не той, що був до нього.
  return prisma.guest.findUnique({ where: { id: guest.id } });
};

/**
 * Актуальні дані картки гостя: номер і баланс.
 * Баланс завжди читаємо з Syrve — у себе ми його не дублюємо.
 */
export const getGuestCard = async (guest) => {
  const client = getSyrveClient();

  const customer = await client.findCustomerById(guest.syrveCustomerId);

  if (!customer) return null;

  const cardNumber =
    guest.cardNumber ?? customer.cards[0]?.number ?? customer.cards[0]?.track;

  return {
    name: customer.name ?? guest.name,
    cardNumber,
    balance: customer.balance,
  };
};
