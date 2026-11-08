import { TRANSACTIONS_PAGE_SIZE } from '../constants/index.js';
import { isNotifiable } from '../constants/transactionTypes.js';
import { getSyrveClient } from './syrve/index.js';

/**
 * Читання транзакцій гостя з Syrve — одна реалізація на весь сервіс.
 *
 * `customer/transactions/by_revision` віддає транзакції від указаної ревізії
 * за зростанням і сторінками, тому «усі з такого-то місця» доводиться
 * гортати. Логіка гортання однакова для поллера (О6), бекфілу історії та
 * сторінки історії гостя (Д1), і раніше була скопійована в три місця —
 * будь-яка правка умови виходу мусила б повторитися тричі.
 */

/**
 * Усі транзакції від `fromRevision` (не включно) до кінця.
 *
 * @returns {Promise<{transactions: object[], lastRevision: number}>}
 *   lastRevision — найбільша побачена ревізія; саме її треба зберегти
 *   курсором, навіть якщо всі транзакції відфільтрувалися.
 */
export const fetchTransactionsFrom = async (customerId, fromRevision = 0) => {
  const client = getSyrveClient();

  const collected = [];
  let cursor = Number(fromRevision);

  for (;;) {
    const { transactions, lastRevision } =
      await client.getTransactionsByRevision({
        customerId,
        revision: cursor,
        pageSize: TRANSACTIONS_PAGE_SIZE,
      });

    if (transactions.length === 0) break;

    collected.push(...transactions);

    const maxRevision = Math.max(
      lastRevision ?? 0,
      ...transactions.map((item) => item.revision),
    );

    // Якщо Syrve повернув ту саму сторінку, виходимо: інакше вічний цикл.
    if (maxRevision <= cursor) break;

    cursor = maxRevision;

    if (transactions.length < TRANSACTIONS_PAGE_SIZE) break;
  }

  return { transactions: collected, lastRevision: cursor };
};

/**
 * Два відсіювання, обидва перевірені на живих даних:
 *
 * 1. Чужий гаманець. Гість може бути в кількох програмах (у тестовій
 *    організації їх чотири), і by_revision віддає транзакції всіх.
 * 2. Транзакції, які не змінюють баланс: SetGuestCategory приходить із
 *    sum = 0 і balanceAfter = null.
 */
export const keepProgramTransactions = (transactions, walletId) =>
  transactions.filter((item) => {
    if (item.walletId && item.walletId !== walletId) return false;

    return isNotifiable(item);
  });

/** Рядок ProcessedTransaction із транзакції Syrve. */
export const toProcessedRow = (item, guestId, extra = {}) => ({
  transactionId: String(item.id),
  guestId,
  revision: BigInt(item.revision),
  type: String(item.type ?? 'unknown'),
  typeName: item.typeName ?? null,
  sum: item.sum,
  balanceAfter: item.balanceAfter,
  comment: item.comment ?? null,
  whenCreated: item.whenCreated ? new Date(item.whenCreated) : null,
  ...extra,
});
