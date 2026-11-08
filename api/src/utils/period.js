import { REPORT_TIMEZONE } from '../constants/index.js';

/**
 * Межі періодів для статистики (Д9) і фільтра транзакцій.
 *
 * Рахуємо в часовому поясі закладу, а не в UTC. Причина проста: «сьогодні»
 * для адміністратора — це київська доба. Контейнери живуть у UTC, і без
 * перерахунку операція о 23:30 за Києвом потрапила б у «завтра».
 *
 * Пояс — константа, а не змінна оточення: сервіс робиться для українського
 * закладу, а зайва змінна в .env, яку ніхто не міняє, лише додає способів
 * налаштувати систему неправильно.
 */

const PARTS_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: REPORT_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Дата у вигляді YYYY-MM-DD за київським часом — ключ для рядів графіка. */
export const zonedDayKey = (date) => DAY_FORMAT.format(date);

const zonedParts = (date) => {
  const parts = Object.fromEntries(
    PARTS_FORMAT.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // О 24-й годині Intl віддає "24" замість "00".
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

/** Наскільки місцевий час випереджає UTC у цей момент. */
const offsetMs = (date) => {
  const parts = zonedParts(date);
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000;
};

/**
 * Початок київської доби, до якої належить момент.
 *
 * Зсув береться двічі: у ніч переходу на літній час зсув опівночі інший,
 * ніж удень, і з одного наближення вийшла б похибка в годину.
 */
export const startOfZonedDay = (date) => {
  const { year, month, day } = zonedParts(date);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const firstGuess = new Date(utcMidnight - offsetMs(date));

  return new Date(utcMidnight - offsetMs(firstGuess));
};

/**
 * Початок доби, зсунутої на delta днів.
 *
 * Пів доби додаємо навмисно: доба переходу на літній час триває 23 години,
 * і просте множення на 24 години промахнулося б повз потрібний день.
 */
export const shiftZonedDay = (dayStart, delta) =>
  startOfZonedDay(
    new Date(dayStart.getTime() + delta * 86400000 + 43200000),
  );

/** Список початків діб: [from, from+1, …] довжиною count. */
export const zonedDayStarts = (from, count) => {
  const days = [];
  let cursor = from;

  for (let i = 0; i < count; i += 1) {
    days.push(cursor);
    cursor = shiftZonedDay(cursor, 1);
  }

  return days;
};

/** Скільки діб охоплює період. Для 'all' — скільки днів показує графік. */
export const PERIOD_DAYS = {
  today: 1,
  '7d': 7,
  '30d': 30,
};

/** Графік за весь час обмежуємо, інакше на роки даних вийде нечитна смуга. */
export const ALL_PERIOD_CHART_DAYS = 30;

/**
 * Межі обраного періоду й попереднього такої ж довжини (для порівняння).
 *
 * @param {'today'|'7d'|'30d'|'all'} period
 * @returns {{from: Date|null, to: Date, previous: {from: Date, to: Date}|null,
 *   chartFrom: Date, chartDays: number}}
 */
export const resolvePeriod = (period, now = new Date()) => {
  const todayStart = startOfZonedDay(now);

  if (period === 'all') {
    const chartFrom = shiftZonedDay(todayStart, -(ALL_PERIOD_CHART_DAYS - 1));

    // Порівнювати «весь час» нема з чим — попереднього періоду не існує.
    return {
      from: null,
      to: now,
      previous: null,
      chartFrom,
      chartDays: ALL_PERIOD_CHART_DAYS,
    };
  }

  const days = PERIOD_DAYS[period];
  const from = shiftZonedDay(todayStart, -(days - 1));
  const previousFrom = shiftZonedDay(from, -days);

  return {
    from,
    to: now,
    // Попередній період закінчується рівно там, де починається поточний.
    previous: { from: previousFrom, to: from },
    chartFrom: from,
    chartDays: days,
  };
};

/**
 * Зміна у відсотках. null, якщо порівнювати нема з чим: ділення на нуль
 * дало б «+∞», а показувати «+100%» на старті з нуля — вводити в оману.
 */
export const percentChange = (current, previous) => {
  if (previous === null || previous === undefined) return null;
  if (previous === 0) return null;

  return Math.round(((current - previous) / previous) * 100);
};

/**
 * Умова Prisma «операція сталася в цьому проміжку».
 *
 * Фільтрувати треба за часом операції в Syrve (`whenCreated`), а не за
 * часом нашого запису (`createdAt`): бекфіл історії записує торішні
 * транзакції сьогодні, і за `createdAt` вони всі злиплися б в один день.
 * `createdAt` лишається запасним для рядків, яким Syrve часу не дав.
 */
export const occurredWithin = (range) =>
  range
    ? {
        OR: [
          { whenCreated: range },
          { whenCreated: null, createdAt: range },
        ],
      }
    : {};

/**
 * Порядок «найновіші зверху» за часом операції. Рядки без часу з Syrve
 * падають у кінець — їх не має лишитися після бекфілу.
 */
export const OCCURRED_DESC = [
  { whenCreated: { sort: 'desc', nulls: 'last' } },
  { createdAt: 'desc' },
];
