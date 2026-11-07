import { useCallback, useEffect, useState } from 'react';

import {
  ApiError,
  api,
  type Guest,
  type Operation,
  type SyrveOperation,
} from '../api';
import { formatAmount, formatDate } from '../format';
import { OperationForm } from './OperationForm';
import { OperationsTable } from './OperationsTable';
import { SyrveOperationsTable } from './SyrveOperationsTable';

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
      <div className="card">
        <h2>{guest.name ?? 'Без імені'}</h2>

        <dl className="details">
          <div>
            <dt>Телефон</dt>
            <dd>{guest.phoneFormatted}</dd>
          </div>
          <div>
            <dt>Картка</dt>
            <dd>{guest.cardNumber ?? '—'}</dd>
          </div>
          <div>
            <dt>Баланс</dt>
            <dd className="balance">{formatAmount(guest.balance)}</dd>
          </div>
          <div>
            <dt>Telegram</dt>
            <dd>
              {guest.registeredViaBot ? (
                <span className="badge badge-ok">підключений</span>
              ) : (
                <span className="badge">немає</span>
              )}
            </dd>
          </div>
          {guest.registeredAt && (
            <div>
              <dt>Реєстрація</dt>
              <dd>{formatDate(guest.registeredAt)}</dd>
            </div>
          )}
        </dl>

        {!guest.registeredViaBot && (
          <p className="muted">
            Гість не реєструвався через бота — сповіщення в Telegram він не
            отримає.
          </p>
        )}

        {guest.botBlocked && (
          <div className="alert alert-error">
            Гість заблокував бота — сповіщення йому не надсилаються.
          </div>
        )}
      </div>

      <OperationForm guest={guest} onDone={handleOperationDone} />

      {error && <div className="alert alert-error">{error}</div>}

      <OperationsTable operations={operations} />

      <SyrveOperationsTable operations={syrveOperations} />
    </>
  );
};
