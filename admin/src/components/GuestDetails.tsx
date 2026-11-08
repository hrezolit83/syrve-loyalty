import { useCallback, useEffect, useState } from 'react';

import {
  ApiError,
  api,
  type Guest,
  type Operation,
  type SyrveOperation,
} from '../api';
import { cx } from '../cx';
import { formatAmount, formatDate } from '../format';
import { OperationForm } from './OperationForm';
import { OperationsTable } from './OperationsTable';
import { SyrveOperationsTable } from './SyrveOperationsTable';
import { Alert } from './ui/Alert';
import { Badge } from './ui/Badge';
import { Card, CardTitle } from './ui/Card';
import styles from './GuestDetails.module.css';

/**
 * Картка гостя: дані, форма нарахування/списання і два журнали.
 *
 * Спільний компонент для сторінки пошуку за телефоном (О4) і для переходу
 * зі списку гостей (Д2) — щоб адміністратор бачив однаковий екран незалежно
 * від того, як він знайшов гостя.
 *
 * Гість приходить готовим, а обидва журнали компонент дочитує сам: вони
 * потрібні лише тут, і сторінкам не варто про них знати.
 */
export const GuestDetails = ({
  guest,
  onReload,
}: {
  guest: Guest;
  onReload: () => void;
}) => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [syrveOperations, setSyrveOperations] = useState<SyrveOperation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadJournals = useCallback(async (customerId: string) => {
    try {
      // Паралельно: журнали незалежні, і другий не мусить чекати на перший.
      const [ours, syrve] = await Promise.all([
        api.operations(customerId),
        api.syrveOperations(customerId),
      ]);

      setOperations(ours.operations);
      setSyrveOperations(syrve.operations);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Не вдалося завантажити історію операцій',
      );
    }
  }, []);

  useEffect(() => {
    loadJournals(guest.customerId);
  }, [guest.customerId, loadJournals]);

  const handleOperationDone = useCallback(() => {
    // Баланс перечитує сторінка (він у Syrve), журнали — ми.
    onReload();
    loadJournals(guest.customerId);
  }, [guest.customerId, loadJournals, onReload]);

  return (
    <>
      <Card>
        <CardTitle>{guest.name ?? 'Без імені'}</CardTitle>

        <dl className={styles.details}>
          <div>
            <dt className={styles.term}>Телефон</dt>
            <dd className={styles.value}>{guest.phoneFormatted}</dd>
          </div>
          <div>
            <dt className={styles.term}>Картка</dt>
            <dd className={styles.value}>{guest.cardNumber ?? '—'}</dd>
          </div>
          <div>
            <dt className={styles.term}>Баланс</dt>
            <dd className={cx(styles.value, styles.balance)}>
              {formatAmount(guest.balance)}
            </dd>
          </div>
          <div>
            <dt className={styles.term}>Telegram</dt>
            <dd className={styles.value}>
              {guest.registeredViaBot ? (
                <Badge status="ok">підключений</Badge>
              ) : (
                <Badge>немає</Badge>
              )}
            </dd>
          </div>
          {guest.registeredAt && (
            <div>
              <dt className={styles.term}>Реєстрація</dt>
              <dd className={styles.value}>{formatDate(guest.registeredAt)}</dd>
            </div>
          )}
        </dl>

        {!guest.registeredViaBot && (
          <p className={styles.note}>
            Гість не реєструвався через бота — сповіщення в Telegram він не
            отримає.
          </p>
        )}

        {guest.botBlocked && (
          <Alert>Гість заблокував бота — сповіщення йому не надсилаються.</Alert>
        )}
      </Card>

      <OperationForm guest={guest} onDone={handleOperationDone} />

      {error && <Alert>{error}</Alert>}

      <OperationsTable operations={operations} />

      <SyrveOperationsTable operations={syrveOperations} />
    </>
  );
};
