import {
  AUDIT_ACTIONS,
  REPORT_TIMEZONE,
  TRANSACTIONS_EXPORT_LIMIT,
} from '../constants/index.js';
import { requestIp, writeAuditLog } from '../services/audit.js';
import {
  getTransactions,
  getTransactionsForExport,
} from '../services/transactions.js';
import { buildCsv } from '../utils/csv.js';
import { formatAmount } from '../templates/messages.js';

export const getTransactionsController = async (req, res) => {
  const data = await getTransactions(req.validatedQuery);

  res.json({ status: 200, message: 'ok', data });
};

/**
 * Дата в CSV — київська й читабельна. ISO Excel в українській локалі не
 * розпізнає як дату й лишає рядком, тому користі від нього там немає.
 */
const CSV_DATE_FORMAT = new Intl.DateTimeFormat('uk-UA', {
  timeZone: REPORT_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const SOURCE_LABELS = {
  panel: 'Панель',
  syrve: 'Syrve',
};

const CSV_HEADERS = [
  'Дата',
  'Гість',
  'Телефон',
  'Тип',
  'Сума',
  'Баланс після',
  'Коментар',
  'Джерело',
  'Тип у Syrve',
];

/**
 * Експорт журналу в CSV.
 *
 * Віддаємо файлом, а не JSON: cookie з токеном httpOnly їде разом зі
 * звичайним переходом за посиланням, тому панелі достатньо <a download>.
 */
export const exportTransactionsController = async (req, res) => {
  const rows = await getTransactionsForExport({
    ...req.validatedQuery,
    limit: TRANSACTIONS_EXPORT_LIMIT,
  });

  const csv = buildCsv(
    CSV_HEADERS,
    rows.map((row) => [
      CSV_DATE_FORMAT.format(new Date(row.date)),
      row.guest.name ?? 'Без імені',
      row.guest.phoneFormatted,
      row.sum < 0 ? 'Списання' : 'Нарахування',
      formatAmount(Math.abs(row.sum)),
      row.balanceAfter === null ? '' : formatAmount(row.balanceAfter),
      row.comment ?? '',
      SOURCE_LABELS[row.source],
      row.typeName ?? row.type ?? '',
    ]),
  );

  // Вивантаження даних гостей — дія, яку має бути видно в журналі.
  await writeAuditLog({
    admin: req.admin,
    action: AUDIT_ACTIONS.TRANSACTIONS_EXPORT,
    targetType: 'transactions',
    details: { ...req.validatedQuery, rows: rows.length },
    ip: requestIp(req),
  });

  const stamp = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="transactions-${stamp}.csv"`,
  );
  res.send(csv);
};
