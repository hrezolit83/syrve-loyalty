/**
 * Формати чисел і дат для панелі — українські.
 *
 * Intl.NumberFormat('uk-UA') ставить кому як десятковий роздільник і
 * нерозривний пробіл у розрядах (1 250,75). Цілі суми показуємо без копійок,
 * дробові — завжди з двома знаками, щоб «12,5» не читалося як обрізане.
 * Ті самі правила діють у повідомленнях бота (api/src/templates/messages.js),
 * щоб гість і адміністратор бачили однакові числа.
 */

const INTEGER_FORMAT = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
});

const DECIMAL_FORMAT = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatAmount = (amount: number | string | null | undefined) => {
  const value = Number(amount);

  if (!Number.isFinite(value)) return '—';

  return Number.isInteger(value)
    ? INTEGER_FORMAT.format(value)
    : DECIMAL_FORMAT.format(value);
};

/** Сума зі знаком: +150 або −12,50. Мінус — типографський (U+2212). */
export const formatSigned = (amount: number) => {
  const value = Number(amount);
  const sign = value < 0 ? '−' : '+';

  return `${sign}${formatAmount(Math.abs(value))}`;
};

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

/**
 * Дата графіка приходить як YYYY-MM-DD — це вже київська доба, порахована
 * на сервері. Беремо її як є, без new Date(): інакше браузер у іншому поясі
 * зсунув би підпис на добу.
 */
const [DAY_SHORT, DAY_LONG] = [
  new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' }),
  new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' }),
];

const parseDayKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day);
};

/** 08.11 — підпис осі. */
export const formatDayLabel = (value: string) =>
  DAY_SHORT.format(parseDayKey(value));

/** 8 листопада — підпис у підказці. */
export const formatDayLong = (value: string) =>
  DAY_LONG.format(parseDayKey(value));
