import { REPORT_TIMEZONE } from '../constants/index.js';
import { prisma } from '../db/prisma.js';
import {
  percentChange,
  resolvePeriod,
  zonedDayKey,
  zonedDayStarts,
} from '../utils/period.js';

/**
 * Д9: статистика для головної сторінки панелі.
 *
 * Джерело сум і кількостей — таблиця `processed_transactions`, а не наш
 * журнал `operations`. Різниця принципова: `operations` містить лише ручні
 * операції з панелі (і невдалі спроби теж), а керівника закладу цікавлять
 * усі зміни балансу — зокрема нарахування на касі й правки з кабінету
 * Syrve Loyalty.
 *
 * Фільтрувати за гаманцем тут не треба: поллер (`transactionSync`) відсіює
 * чужі гаманці ще до запису, тому в цій таблиці лежать тільки транзакції
 * гаманця нашої програми.
 *
 * Напрямок операції визначає ЗНАК СУМИ, а не тип транзакції — те саме
 * правило, що в сповіщеннях (див. constants/transactionTypes.js).
 */

/** Кількість і сума транзакцій одного напрямку за період. */
const sumByDirection = async (direction, range) => {
  const result = await prisma.processedTransaction.aggregate({
    where: {
      ...range,
      sum: direction === 'topup' ? { gt: 0 } : { lt: 0 },
    },
    _sum: { sum: true },
    _count: { _all: true },
  });

  return {
    count: result._count._all,
    // Списання лежать від'ємними — назовні віддаємо модуль, щоб у картці
    // не було «−340» під підписом «Списано».
    sum: Math.abs(Number(result._sum.sum ?? 0)),
  };
};

/** Усі показники за один проміжок часу. */
const collectTotals = async (range) => {
  const [newGuests, topup, chargeoff] = await Promise.all([
    prisma.guest.count({ where: range }),
    sumByDirection('topup', range),
    sumByDirection('chargeoff', range),
  ]);

  return {
    newGuests,
    operations: topup.count + chargeoff.count,
    topupSum: topup.sum,
    chargeoffSum: chargeoff.sum,
  };
};

/**
 * Операції по днях для графіка.
 *
 * Групування робить PostgreSQL: `AT TIME ZONE` розкладає позначку часу по
 * київських добах одним запитом, тоді як вибірка всіх рядків у Node і
 * групування вручну з'їдала б пам'ять на великому періоді.
 */
const collectSeries = async (chartFrom, chartDays) => {
  // Подвійне AT TIME ZONE не зайве: created_at — timestamp БЕЗ зони, у якому
  // лежить UTC. Перше перетворення каже PostgreSQL, що це саме UTC, друге
  // переводить у київський час. З одним перетворенням операція о 01:04 ночі
  // за Києвом потрапляла б у попередню добу — перевірено на живих даних.
  const rows = await prisma.$queryRaw`
    SELECT (created_at AT TIME ZONE 'UTC' AT TIME ZONE ${REPORT_TIMEZONE})::date AS day,
           count(*) FILTER (WHERE sum > 0)::int AS topup,
           count(*) FILTER (WHERE sum < 0)::int AS chargeoff
      FROM processed_transactions
     WHERE created_at >= ${chartFrom}
     GROUP BY 1
     ORDER BY 1
  `;

  // PostgreSQL віддає date як опівніч UTC, тому ISO-зріз дає потрібний ключ.
  const byDay = new Map(
    rows.map((row) => [
      row.day.toISOString().slice(0, 10),
      { topup: row.topup, chargeoff: row.chargeoff },
    ]),
  );

  // Дні без операцій мають лишитися в ряду нулями, інакше графік стиснеться
  // і покаже суцільну активність там, де її не було.
  return zonedDayStarts(chartFrom, chartDays).map((dayStart) => {
    const date = zonedDayKey(dayStart);
    const found = byDay.get(date);

    return {
      date,
      topup: found?.topup ?? 0,
      chargeoff: found?.chargeoff ?? 0,
    };
  });
};

export const getStats = async ({ period }) => {
  const { from, to, previous, chartFrom, chartDays } = resolvePeriod(period);

  const range = from ? { createdAt: { gte: from, lte: to } } : {};

  const [guestsTotal, totals, previousTotals, series] = await Promise.all([
    prisma.guest.count(),
    collectTotals(range),
    previous
      ? collectTotals({ createdAt: { gte: previous.from, lt: previous.to } })
      : Promise.resolve(null),
    collectSeries(chartFrom, chartDays),
  ]);

  return {
    period,
    from: from ?? null,
    to,
    totals: { guests: guestsTotal, ...totals },
    // Для «за весь час» попереднього періоду не існує, тому порівняння немає.
    changes: previousTotals
      ? {
          newGuests: percentChange(totals.newGuests, previousTotals.newGuests),
          operations: percentChange(
            totals.operations,
            previousTotals.operations,
          ),
          topupSum: percentChange(totals.topupSum, previousTotals.topupSum),
          chargeoffSum: percentChange(
            totals.chargeoffSum,
            previousTotals.chargeoffSum,
          ),
        }
      : null,
    series,
  };
};
