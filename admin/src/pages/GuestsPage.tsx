import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { ApiError, api, type GuestListItem } from '../api';
import { formatDateTime } from '../format';

/**
 * Д2: список гостей, зареєстрованих через бот.
 *
 * Балансу в списку немає свідомо: він живе в Syrve, і щоб показати його для
 * 20 рядків, довелося б робити 20 запитів до Syrve на кожне відкриття
 * сторінки. Баланс видно на картці гостя, де запит один.
 */

type Sort = 'createdAt' | 'name';
type Order = 'asc' | 'desc';

const SORT_LABELS: Record<Sort, string> = {
  createdAt: 'Дата реєстрації',
  name: "Ім'я",
};

export const GuestsPage = () => {
  const [items, setItems] = useState<GuestListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>('createdAt');
  const [order, setOrder] = useState<Order>('desc');
  // Окремо введений текст і застосований пошук: запит іде на Enter або
  // кнопку, а не на кожну натиснуту літеру.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await api.guests({ search, sort, order, page });

      setItems(data.guests);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err) {
      setItems([]);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Не вдалося завантажити список гостей',
      );
    } finally {
      setIsLoading(false);
    }
  }, [order, page, search, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  /** Клік по заголовку: той самий стовпець — розворот, інший — новий. */
  const toggleSort = (column: Sort) => {
    setPage(1);

    if (sort === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSort(column);
    setOrder(column === 'name' ? 'asc' : 'desc');
  };

  const sortMark = (column: Sort) =>
    sort === column ? (order === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div className="stack">
      <form className="card" onSubmit={handleSearch}>
        <h2>Гості</h2>
        <p className="muted">
          Усі гості, зареєстровані через Telegram-бот: {total}
        </p>

        <div className="form-row">
          <label className="grow">
            Пошук за іменем, телефоном або номером картки
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Наприклад: Олена або 067"
            />
          </label>

          <button type="submit" className="align-end" disabled={isLoading}>
            {isLoading ? 'Шукаємо…' : 'Знайти'}
          </button>

          {search && (
            <button
              type="button"
              className="align-end secondary"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setPage(1);
              }}
            >
              Скинути
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
      </form>

      <div className="card">
        {items.length === 0 ? (
          <p className="muted">
            {search
              ? 'За цим запитом гостей не знайдено.'
              : 'Поки що жоден гість не зареєструвався через бота.'}
          </p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      className="th-sort"
                      onClick={() => toggleSort('name')}
                    >
                      {SORT_LABELS.name}
                      {sortMark('name')}
                    </button>
                  </th>
                  <th>Телефон</th>
                  <th>Картка</th>
                  <th>
                    <button
                      type="button"
                      className="th-sort"
                      onClick={() => toggleSort('createdAt')}
                    >
                      {SORT_LABELS.createdAt}
                      {sortMark('createdAt')}
                    </button>
                  </th>
                  <th>Telegram</th>
                </tr>
              </thead>
              <tbody>
                {items.map((guest) => (
                  <tr key={guest.id}>
                    <td>
                      {guest.customerId ? (
                        <Link to={`/guests/${guest.customerId}`}>
                          {guest.name ?? 'Без імені'}
                        </Link>
                      ) : (
                        (guest.name ?? 'Без імені')
                      )}
                    </td>
                    <td className="nowrap">{guest.phoneFormatted}</td>
                    <td className="nowrap">{guest.cardNumber ?? '—'}</td>
                    <td className="nowrap">{formatDateTime(guest.createdAt)}</td>
                    <td>
                      {guest.botBlocked ? (
                        <span className="badge badge-fail">заблокував бота</span>
                      ) : (
                        <span className="badge badge-ok">активний</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1 || isLoading}
                >
                  ← Назад
                </button>

                <span className="muted">
                  Сторінка {page} з {totalPages}
                </span>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages || isLoading}
                >
                  Далі →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
