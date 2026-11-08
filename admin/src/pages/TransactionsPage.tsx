import { Download } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  ApiError,
  api,
  type Period,
  type Transaction,
  type TransactionFilters,
} from '../api';
import { PeriodSwitch } from '../components/PeriodSwitch';
import {
  SegmentedSwitch,
  type SegmentedOption,
} from '../components/SegmentedSwitch';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Table, Td, Th, Tr } from '../components/ui/Table';
import { formatAmount, formatDateTime, formatSigned } from '../format';
import styles from './TransactionsPage.module.css';

/**
 * Журнал транзакцій усіх гостей закладу.
 *
 * Читається з таблиці, яку наповнює поллер (О6), тому сюди потрапляють усі
 * зміни балансу в гаманці нашої програми — і з панелі, і з каси, і з
 * кабінету Syrve Loyalty. Межа, про яку варто знати: видно лише гостей,
 * зареєстрованих через бот, бо решту сервіс не опитує.
 */

type TypeFilter = TransactionFilters['type'];

const TYPE_OPTIONS: SegmentedOption<TypeFilter>[] = [
  { value: '', label: 'Усі' },
  { value: 'topup', label: 'Нарахування' },
  { value: 'chargeoff', label: 'Списання' },
];

const SOURCE_LABELS: Record<Transaction['source'], string> = {
  panel: 'Панель',
  syrve: 'Syrve',
};

export const TransactionsPage = () => {
  const [period, setPeriod] = useState<Period>('30d');
  const [type, setType] = useState<TypeFilter>('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await api.transactions({ period, type, page });

      setItems(data.transactions);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err) {
      setItems([]);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Не вдалося завантажити транзакції',
      );
    } finally {
      setIsLoading(false);
    }
  }, [period, type, page]);

  useEffect(() => {
    load();
  }, [load]);

  /** Зміна фільтра завжди повертає на першу сторінку. */
  const changePeriod = (value: Period) => {
    setPage(1);
    setPeriod(value);
  };

  const changeType = (value: TypeFilter) => {
    setPage(1);
    setType(value);
  };

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Транзакції</h1>

        <ButtonLink
          variant="secondary"
          href={api.transactionsExportUrl({ period, type })}
          download
        >
          <Download aria-hidden="true" />
          Експорт CSV
        </ButtonLink>
      </div>

      <Card>
        <div className={styles.filters}>
          <PeriodSwitch
            value={period}
            onChange={changePeriod}
            disabled={isLoading}
          />

          <SegmentedSwitch
            label="Тип операції"
            options={TYPE_OPTIONS}
            value={type}
            onChange={changeType}
            disabled={isLoading}
          />

          <span className={styles.summary}>
            {isLoading && <Spinner />}
            Знайдено: {formatAmount(total)}
          </span>
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}

      <Card>
        <CardTitle>Зміни балансу</CardTitle>

        {items.length === 0 ? (
          <p className={styles.empty}>
            За цими умовами транзакцій немає. Сюди потрапляють зміни балансу
            гостей, зареєстрованих через бот.
          </p>
        ) : (
          <>
            <Table>
              <thead>
                <Tr>
                  <Th>Коли</Th>
                  <Th>Гість</Th>
                  <Th right>Сума</Th>
                  <Th right>Баланс після</Th>
                  <Th>Коментар</Th>
                  <Th>Джерело</Th>
                </Tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <Tr key={item.id}>
                    <Td primary nowrap>
                      {formatDateTime(item.date)}
                    </Td>
                    <Td label="Гість">
                      {item.guest.customerId ? (
                        <Link
                          to={`/guests/${item.guest.customerId}`}
                          className={styles.guestLink}
                        >
                          {item.guest.name ?? 'Без імені'}
                        </Link>
                      ) : (
                        (item.guest.name ?? 'Без імені')
                      )}
                      <span className={styles.phone}>
                        {item.guest.phoneFormatted}
                      </span>
                    </Td>
                    <Td
                      primary
                      right
                      nowrap
                      className={
                        item.sum < 0 ? styles.amountMinus : styles.amountPlus
                      }
                    >
                      {formatSigned(item.sum)}
                    </Td>
                    <Td label="Баланс після" right nowrap>
                      {item.balanceAfter === null
                        ? '—'
                        : formatAmount(item.balanceAfter)}
                    </Td>
                    <Td label="Коментар">{item.comment ?? '—'}</Td>
                    {/* Обидва джерела нейтральні: «панель» — це не «добре»,
                        а просто звідки прийшов запис. Різницю несе підпис. */}
                    <Td label="Джерело" nowrap>
                      <Badge title={item.typeName ?? item.type ?? undefined}>
                        {SOURCE_LABELS[item.source]}
                      </Badge>
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
