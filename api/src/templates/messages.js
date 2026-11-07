import { GUEST_NAME_MAX, GUEST_NAME_MIN } from '../constants/index.js';

/**
 * Усі тексти для гостя — в одному файлі.
 * Інтерфейс лише українською (вимога ТЗ, розділ 3).
 */

/** Бонуси: 1 бонус, 2 бонуси, 5 бонусів, 12,50 бонуса. */
export const pluralizeBonus = (amount) => {
  const abs = Math.abs(Number(amount));

  // З дробовою частиною в українській — родовий однини: "12,50 бонуса".
  if (!Number.isInteger(abs)) return 'бонуса';

  const int = Math.trunc(abs);
  const lastTwo = int % 100;
  const last = int % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return 'бонусів';
  if (last === 1) return 'бонус';
  if (last >= 2 && last <= 4) return 'бонуси';
  return 'бонусів';
};

/** 110 або 110.50 — без зайвих нулів. */
export const formatAmount = (amount) => {
  const value = Number(amount);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

export const formatBonuses = (amount) =>
  `${formatAmount(amount)} ${pluralizeBonus(amount)}`;

export const MESSAGES = {
  greetNew: [
    'Вітаємо в програмі лояльності! 🎉',
    '',
    'Щоб видати вам картку, потрібен ваш номер телефону.',
    'Натисніть кнопку «📱 Надіслати контакт» нижче.',
  ].join('\n'),

  greetKnown: (name) =>
    [
      `Вітаємо, ${name}! 👋`,
      '',
      'Ваша картка вже активна. Користуйтеся кнопками нижче.',
    ].join('\n'),

  needOwnContact:
    'Будь ласка, надішліть саме свій контакт кнопкою «📱 Надіслати контакт» — ' +
    'зареєструвати чужий номер не можемо.',

  needContactButton:
    'Скористайтеся кнопкою «📱 Надіслати контакт» нижче — так Telegram ' +
    'підтвердить, що номер справді ваш.',

  phoneNotSupported:
    'Не вдалося розпізнати номер. Поки що працюємо з українськими номерами ' +
    '(+380XXXXXXXXX).',

  askName: 'Дякуємо! Тепер напишіть, як до вас звертатися.',

  nameTooShort: `Ім'я має містити від ${GUEST_NAME_MIN} до ${GUEST_NAME_MAX} символів. Спробуйте ще раз.`,

  nameInvalid:
    "Ім'я може містити лише літери, пробіл, дефіс і апостроф. Спробуйте ще раз.",

  registered: ({ name, cardNumber }) =>
    [
      `Готово, ${name}! ✅`,
      '',
      `Номер вашої картки: ${cardNumber}`,
      '',
      'Показуйте QR-код на касі, щоб отримувати бонуси.',
    ].join('\n'),

  cardCaption: ({ cardNumber, balance }) =>
    [
      '💳 Ваша картка',
      '',
      `Номер: ${cardNumber}`,
      `Баланс: ${formatBonuses(balance)}`,
    ].join('\n'),

  balance: (balance) => `На вашому рахунку ${formatBonuses(balance)}.`,

  notRegistered:
    'Спочатку потрібно зареєструватися. Надішліть команду /start.',

  cardMissing:
    'Не знайшли вашу картку в Syrve. Напишіть /start, щоб зареєструватися знову.',

  unknownCommand:
    'Не зрозумів команду. Скористайтеся кнопками нижче або надішліть /start.',

  syrveUnavailable:
    'Сервіс лояльності тимчасово недоступний. Спробуйте, будь ласка, за хвилину.',

  genericError:
    'Щось пішло не так. Ми вже знаємо про це — спробуйте, будь ласка, пізніше.',

  // balanceAfter може бути null: Syrve не завжди його віддає (перевірено
  // на живому API). Краще не написати про баланс, ніж написати неправильний.
  notifyTopUp: ({ sum, balanceAfter, comment }) =>
    [
      `✅ Нараховано ${formatBonuses(sum)}.`,
      ...(balanceAfter === null || balanceAfter === undefined
        ? []
        : [`Баланс: ${formatBonuses(balanceAfter)}.`]),
      ...(comment ? ['', comment] : []),
    ].join('\n'),

  notifyChargeOff: ({ sum, balanceAfter, comment }) =>
    [
      `➖ Списано ${formatBonuses(sum)}.`,
      ...(balanceAfter === null || balanceAfter === undefined
        ? []
        : [`Баланс: ${formatBonuses(balanceAfter)}.`]),
      ...(comment ? ['', comment] : []),
    ].join('\n'),
};
