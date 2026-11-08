import { getSyrveClient } from './syrve/index.js';
import {
  fetchTransactionsFrom,
  keepProgramTransactions,
} from './transactionFeed.js';

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

  const { transactions } = await fetchTransactionsFrom(customerId, 0);

  // Ті самі два фільтри, що й у поллера: лише гаманець нашої програми
  // і лише транзакції, які справді змінюють баланс.
  const relevant = keepProgramTransactions(transactions, program.walletId);

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
