import { Search, Users } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { ApiError, api, type GuestListItem } from '../api';
import { formatDateTime } from '../format';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardForm, CardTitle } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { FormRow } from '../components/ui/FormRow';
import { Spinner } from '../components/ui/Spinner';
import { Table, Td, Th, Tr } from '../components/ui/Table';
import styles from './GuestsPage.module.css';

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

  const sortHeader = (column: Sort) => (
    <button
      type="button"
      className={styles.sortButton}
      onClick={() => toggleSort(column)}
    >
      {SORT_LABELS[column]}
      {sortMark(column)}
    </button>
  );

  return (
    <>
      <CardForm onSubmit={handleSearch}>
        <CardTitle>
          <Users aria-hidden="true" />
          Гості
        </CardTitle>
        <p className={styles.total}>
          Гості, зареєстровані через Telegram-бот: {total}
        </p>

        <FormRow>
          <Field
            grow
            label="Пошук за іменем, телефоном або номером картки"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Наприклад: Олена або 067"
          />

          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Spinner /> : <Search aria-hidden="true" />}
            {isLoading ? 'Шукаємо…' : 'Знайти'}
          </Button>

          {search && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setPage(1);
              }}
            >
              Скинути
            </Button>
          )}
        </FormRow>

        {error && <Alert>{error}</Alert>}
      </CardForm>

      <Card>
        {items.length === 0 ? (
          <p className={styles.empty}>
            {search
              ? 'За цим запитом гостей не знайдено.'
              : 'Поки що жоден гість не зареєструвався через бота.'}
          </p>
        ) : (
          <>
            <Table>
              <thead>
                <Tr>
                  <Th>{sortHeader('name')}</Th>
                  <Th>Телефон</Th>
                  <Th>Картка</Th>
                  <Th>{sortHeader('createdAt')}</Th>
                  <Th>Telegram</Th>
                </Tr>
              </thead>
              <tbody>
                {items.map((guest) => (
                  <Tr key={guest.id}>
                    <Td primary>
                      {guest.customerId ? (
                        <Link
                          to={`/guests/${guest.customerId}`}
                          className={styles.guestLink}
                        >
                          {guest.name ?? 'Без імені'}
                        </Link>
                      ) : (
                        (guest.name ?? 'Без імені')
                      )}
                    </Td>
                    <Td label="Телефон" nowrap>
                      {guest.phoneFormatted}
                    </Td>
                    <Td label="Картка" nowrap>
                      {guest.cardNumber ?? '—'}
                    </Td>
                    <Td label="Реєстрація" nowrap>
                      {formatDateTime(guest.createdAt)}
                    </Td>
                    <Td primary>
                      {guest.botBlocked ? (
                        <Badge status="fail">заблокував бота</Badge>
                      ) : (
                        <Badge status="ok">активний</Badge>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1 || isLoading}
                >
                  ← Назад
                </Button>

                <span className={styles.pageCounter}>
                  Сторінка {page} з {totalPages}
                </span>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages || isLoading}
                >
                  Далі →
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
};
