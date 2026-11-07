import { useCallback, useState, type FormEvent } from 'react';

import { ApiError, api, type Guest, type Operation } from '../api';
import { OperationForm } from '../components/OperationForm';
import { OperationsTable } from '../components/OperationsTable';

/**
 * Пошук гостя за телефоном (О4) + операції з його бонусами (О5).
 *
 * Після кожної операції перечитуємо і гостя, і журнал: баланс живе в Syrve,
 * і показувати його зі свого стану — означає показувати вчорашній день.
 */
export const SearchPage = () => {
  const [phone, setPhone] = useState('');
  const [guest, setGuest] = useState<Guest | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const loadGuest = useCallback(async (phoneValue: string) => {
    const found = await api.searchGuest(phoneValue);
    setGuest(found);

    const { operations: list } = await api.operations(found.customerId);
    setOperations(list);
  }, []);

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSearching(true);

    try {
      await loadGuest(phone.trim());
    } catch (err) {
      setGuest(null);
      setOperations([]);
      setError(
        err instanceof ApiError ? err.message : 'Не вдалося виконати пошук',
      );
    } finally {
      setIsSearching(false);
    }
  };

  const refresh = useCallback(() => {
    if (guest) {
      loadGuest(guest.phone).catch(() => {
        setError('Не вдалося оновити дані гостя');
      });
    }
  }, [guest, loadGuest]);

  return (
    <div className="stack">
      <form className="card" onSubmit={handleSearch}>
        <h2>Пошук гостя</h2>

        <div className="form-row">
          <label className="grow">
            Телефон
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+380XXXXXXXXX або 0XXXXXXXXX"
              autoFocus
              required
            />
          </label>

          <button type="submit" disabled={isSearching} className="align-end">
            {isSearching ? 'Шукаємо…' : 'Знайти'}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
      </form>

      {guest && (
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
                <dd className="balance">{guest.balance}</dd>
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
            </dl>

            {!guest.registeredViaBot && (
              <p className="muted">
                Гість не реєструвався через бота — сповіщення в Telegram він не
                отримає.
              </p>
            )}
          </div>

          <OperationForm guest={guest} onDone={refresh} />

          <OperationsTable operations={operations} />
        </>
      )}
    </div>
  );
};
