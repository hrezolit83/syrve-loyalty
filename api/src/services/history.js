import { TRANSACTIONS_PAGE_SIZE } from '../constants/index.js';
import { isNotifiable } from '../constants/transactionTypes.js';
import { getSyrveClient } from './syrve/index.js';

/**
 * Історія операцій гостя (Д1) — читається з Syrve, не з нашої БД.
 *
 * Чому з Syrve: наш журнал `operations` містить лише ручні операції з панелі.
 * Гостя ж цікавлять усі зміни балансу — зокрема нарахування на касі й
 * правки з кабінету Syrve Loyalty, про які наш сервіс нічого не знає.
 *
 * `by_revision` віддає транзакції від вказаної ревізії за зростанням і
 * сторінками, тому «останні N» доводиться збирати з повного списку й
 * розвертати. Для сервісу такого масштабу це прийнятно: у гостя закладу
 * десятки, рідко сотні операцій. На великих обсягах тут потрібен
 * `transactions/by_date` з періодом — метод існує, але в тестовій
 * організації перевірити його на реальних даних не вдалося, тому
 * залишаємо те, що точно працює.
 */
export const getGuestSyrveHistory = async (customerId, limit = 10) => {
  const client = getSyrveClient();
  const program = await client.getProgram();

  const collected = [];
  let cursor = 0;

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

    if (maxRevision <= cursor) break;

    cursor = maxRevision;

    if (transactions.length < TRANSACTIONS_PAGE_SIZE) break;
  }

  // Ті самі два фільтри, що й у поллера: лише гаманець нашої програми
  // і лише транзакції, які справді змінюють баланс.
  const relevant = collected.filter((item) => {
    if (item.walletId && item.walletId !== program.walletId) return false;

    return isNotifiable(item);
  });

  return relevant
    .sort((a, b) => b.revision - a.revision)
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      revision: item.revision,
      type: item.type,
      typeName: item.typeName,
      sum: item.sum,
      balanceAfter: item.balanceAfter,
      comment: item.comment,
      whenCreated: item.whenCreated,
    }));
};
