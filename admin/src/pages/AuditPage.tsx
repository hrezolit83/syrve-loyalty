import { useCallback, useEffect, useState } from 'react';

import {
  ApiError,
  api,
  type AdminAccount,
  type AuditAction,
  type AuditEntry,
  type Period,
} from '../api';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_ORDER,
  formatAuditDetails,
} from '../auditActions';
import { PeriodSwitch } from '../components/PeriodSwitch';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Table, Td, Th, Tr } from '../components/ui/Table';
import { formatAmount, formatDateTime } from '../format';
import styles from './AuditPage.module.css';

/**
 * Д10: журнал дій адміністраторів. Розділ бачить лише власник.
 *
 * Лише читання — редагувати чи видаляти записи не можна ні тут, ні
 * через API. Фільтри: адміністратор, тип дії, період.
 */
export const AuditPage = () => {
  const [period, setPeriod] = useState<Period>('7d');
  const [adminId, setAdminId] = useState('');
  const [action, setAction] = useState<'' | AuditAction>('');
  const [page, setPage] = useState(1);

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Список адміністраторів потрібен лише для випадного списку у фільтрі,
  // тому читається один раз, а не на кожну зміну фільтрів.
  useEffect(() => {
    api
      .admins()
      .then((data) => setAdmins(data.admins))
      .catch(() => setAdmins([]));
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await api.audit({ adminId, action, period, page });

      setEntries(data.entries);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err) {
      setEntries([]);
      setError(
        err instanceof ApiError ? err.message : 'Не вдалося завантажити журнал',
      );
    } finally {
      setIsLoading(false);
    }
  }, [adminId, action, period, page]);

  useEffect(() => {
    load();
  }, [load]);

  /** Будь-яка зміна фільтра повертає на першу сторінку. */
  const changePeriod = (value: Period) => {
    setPage(1);
    setPeriod(value);
  };

  return (
    <>
      <h1 className={styles.title}>Журнал дій</h1>
      <p className={styles.subtitle}>
        Хто й що робив у панелі. Записи не можна змінити чи видалити
      </p>

      <Card>
        <div className={styles.filters}>
          <PeriodSwitch
            value={period}
            onChange={changePeriod}
            disabled={isLoading}
          />

          <select
            className={styles.select}
            aria-label="Адміністратор"
            value={adminId}
            disabled={isLoading}
            onChange={(event) => {
              setPage(1);
              setAdminId(event.target.value);
            }}
          >
            <option value="">Усі адміністратори</option>
            {admins.map((account) => (
              <option key={account.id} value={account.id}>
                {account.login}
              </option>
            ))}
          </select>

          <select
            className={styles.select}
            aria-label="Тип дії"
            value={action}
            disabled={isLoading}
            onChange={(event) => {
              setPage(1);
              setAction(event.target.value as '' | AuditAction);
            }}
          >
            <option value="">Усі дії</option>
            {AUDIT_ACTION_ORDER.map((value) => (
              <option key={value} value={value}>
                {AUDIT_ACTION_LABELS[value]}
              </option>
            ))}
          </select>

          <span className={styles.summary}>
            {isLoading && <Spinner />}
            Записів: {formatAmount(total)}
          </span>
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}

      <Card>
        <CardTitle>Події</CardTitle>

        {entries.length === 0 ? (
          <p className={styles.empty}>За цими умовами записів немає.</p>
        ) : (
          <>
            <Table>
              <thead>
                <Tr>
                  <Th>Коли</Th>
                  <Th>Хто</Th>
                  <Th>Дія</Th>
                  <Th>Деталі</Th>
                </Tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Tr key={entry.id}>
                    <Td nowrap>{formatDateTime(entry.createdAt)}</Td>
                    <Td nowrap>
                      {entry.adminLogin}
                      {entry.ip && (
                        <span className={styles.ip}> · {entry.ip}</span>
                      )}
                    </Td>
                    <Td nowrap>
                      {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                    </Td>
                    <Td className={styles.details}>
                      {formatAuditDetails(entry.details)}
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
