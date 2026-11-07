import { Bot, InputFile } from 'grammy';

import { GUEST_NAME_MAX, GUEST_NAME_MIN } from '../constants/index.js';
import {
  findGuestByTelegramId,
  getGuestCard,
  registerGuest,
} from '../services/guests.js';
import { SyrveError, SyrveUnavailableError } from '../services/syrve/index.js';
import { MESSAGES } from '../templates/messages.js';
import { getEnvVar } from '../utils/getEnvVar.js';
import { logger } from '../utils/logger.js';
import { normalizePhone } from '../utils/phone.js';
import { renderCardQr } from '../utils/qr.js';
import { BUTTONS, contactKeyboard, menuKeyboard } from './keyboards.js';
import { clearState, getState, setState, STEPS } from './state.js';

/**
 * Telegram-бот гостя (О2, О3). Живе в процесі worker разом із чергами
 * й поллером: бот потрібен і як слухач команд, і як відправник сповіщень.
 *
 * Токен-заглушка — щоб конструктор не падав, коли TELEGRAM_BOT_TOKEN не
 * заданий; у цьому разі startBot() нічого не запускає й до Telegram не йде.
 */
export const bot = new Bot(
  getEnvVar('TELEGRAM_BOT_TOKEN', '000000:disabled-token'),
);

export const isBotEnabled = () =>
  Boolean(process.env.TELEGRAM_BOT_TOKEN);

/** Ім'я: літери (укр/лат), пробіл, дефіс, апостроф. */
const NAME_PATTERN = /^[\p{L}\s'’-]+$/u;

const validateName = (raw) => {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');

  if (name.length < GUEST_NAME_MIN || name.length > GUEST_NAME_MAX) {
    return { error: MESSAGES.nameTooShort };
  }

  if (!NAME_PATTERN.test(name)) {
    return { error: MESSAGES.nameInvalid };
  }

  return { name };
};

/** Помилку Syrve перетворюємо на зрозумілий гостю текст; подробиці — в лог. */
const replySyrveError = async (ctx, error, context) => {
  logger.error(
    {
      err: { name: error.name, message: error.message },
      details: error.details ?? null,
      correlationId: error.correlationId ?? null,
      telegramId: ctx.from?.id,
      context,
    },
    'Бот: помилка роботи зі Syrve',
  );

  const text =
    error instanceof SyrveUnavailableError
      ? MESSAGES.syrveUnavailable
      : error instanceof SyrveError
        ? MESSAGES.genericError
        : MESSAGES.genericError;

  await ctx.reply(text);
};

/** Надсилає картку: QR-код номера + підпис із номером і балансом. */
const sendCard = async (ctx, guest) => {
  const card = await getGuestCard(guest);

  if (!card?.cardNumber) {
    await ctx.reply(MESSAGES.cardMissing);
    return;
  }

  const qr = await renderCardQr(card.cardNumber);

  await ctx.replyWithPhoto(new InputFile(qr, `card-${card.cardNumber}.png`), {
    caption: MESSAGES.cardCaption({
      cardNumber: card.cardNumber,
      balance: card.balance,
    }),
    reply_markup: menuKeyboard,
  });
};

export const registerBotHandlers = () => {
  bot.command('start', async (ctx) => {
    const guest = await findGuestByTelegramId(ctx.from.id);

    // Уже зареєстрований — одразу меню, нічого не перепитуємо.
    if (guest?.syrveCustomerId) {
      await clearState(ctx.from.id);
      await ctx.reply(MESSAGES.greetKnown(guest.name ?? ''), {
        reply_markup: menuKeyboard,
      });
      return;
    }

    await setState(ctx.from.id, { step: STEPS.AWAITING_CONTACT });
    await ctx.reply(MESSAGES.greetNew, { reply_markup: contactKeyboard });
  });

  bot.command('help', async (ctx) => {
    const guest = await findGuestByTelegramId(ctx.from.id);

    await ctx.reply(
      guest?.syrveCustomerId ? MESSAGES.greetKnown(guest.name ?? '') : MESSAGES.notRegistered,
      { reply_markup: guest?.syrveCustomerId ? menuKeyboard : undefined },
    );
  });

  // Крок 1: контакт.
  bot.on('message:contact', async (ctx) => {
    const contact = ctx.message.contact;

    // Головна перевірка етапу: Telegram проставляє user_id лише тоді, коли
    // контакт належить самому відправнику. Без цієї перевірки можна було б
    // переслати чужий контакт і зареєструвати чужий номер.
    if (contact.user_id !== ctx.from.id) {
      await ctx.reply(MESSAGES.needOwnContact, {
        reply_markup: contactKeyboard,
      });
      return;
    }

    const phone = normalizePhone(contact.phone_number);

    if (!phone) {
      await ctx.reply(MESSAGES.phoneNotSupported, {
        reply_markup: contactKeyboard,
      });
      return;
    }

    await setState(ctx.from.id, { step: STEPS.AWAITING_NAME, phone });

    // Ім'я з профілю Telegram підставляємо як підказку, але все одно питаємо:
    // у профілі часто нікнейм, а касиру потрібне звертання.
    await ctx.reply(MESSAGES.askName, { reply_markup: { remove_keyboard: true } });
  });

  // Крок 2: ім'я, кнопки меню й усе інше.
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    const telegramId = ctx.from.id;

    if (text === BUTTONS.MY_CARD || text === BUTTONS.REFRESH_BALANCE) {
      const guest = await findGuestByTelegramId(telegramId);

      if (!guest?.syrveCustomerId) {
        await ctx.reply(MESSAGES.notRegistered);
        return;
      }

      try {
        if (text === BUTTONS.MY_CARD) {
          await sendCard(ctx, guest);
          return;
        }

        const card = await getGuestCard(guest);

        if (!card) {
          await ctx.reply(MESSAGES.cardMissing);
          return;
        }

        await ctx.reply(MESSAGES.balance(card.balance), {
          reply_markup: menuKeyboard,
        });
      } catch (error) {
        await replySyrveError(ctx, error, text);
      }

      return;
    }

    const state = await getState(telegramId);

    if (state?.step === STEPS.AWAITING_NAME) {
      const { name, error } = validateName(text);

      if (error) {
        await ctx.reply(error);
        return;
      }

      try {
        const guest = await registerGuest({
          telegramId,
          chatId: ctx.chat.id,
          phone: state.phone,
          name,
        });

        await clearState(telegramId);

        await ctx.reply(
          MESSAGES.registered({ name, cardNumber: guest.cardNumber }),
          { reply_markup: menuKeyboard },
        );

        await sendCard(ctx, guest);
      } catch (error) {
        await replySyrveError(ctx, error, 'registration');
      }

      return;
    }

    if (state?.step === STEPS.AWAITING_CONTACT) {
      await ctx.reply(MESSAGES.needContactButton, {
        reply_markup: contactKeyboard,
      });
      return;
    }

    const guest = await findGuestByTelegramId(telegramId);

    await ctx.reply(
      guest?.syrveCustomerId ? MESSAGES.unknownCommand : MESSAGES.notRegistered,
      { reply_markup: guest?.syrveCustomerId ? menuKeyboard : undefined },
    );
  });

  // Без цього обробника будь-яка помилка в хендлері обриває long polling,
  // і бот тихо перестає відповідати.
  bot.catch((err) => {
    logger.error(
      { err: { name: err.error?.name, message: err.message } },
      'Помилка Telegram-бота',
    );
  });
};

export const startBot = async () => {
  if (!isBotEnabled()) {
    logger.warn('Telegram-бот вимкнений: не заданий TELEGRAM_BOT_TOKEN');
    return;
  }

  registerBotHandlers();

  // bot.start() — long polling, він не завершується, тому await не ставимо.
  // Але .catch() обов'язковий: невалідний токен інакше дав би unhandled
  // rejection і поклав би весь процес воркера разом із чергами.
  bot
    .start({
      onStart: (info) => logger.info(`Telegram-бот @${info.username} запущено`),
    })
    .catch((err) => {
      logger.error({ err }, 'Не вдалося запустити Telegram-бота');
    });
};
