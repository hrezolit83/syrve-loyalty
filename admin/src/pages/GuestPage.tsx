import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError, api, type Guest } from '../api';
import { GuestDetails } from '../components/GuestDetails';

/**
 * Картка гостя за посиланням зі списку (Д2).
 *
 * Гість читається за id у Syrve, а не з нашої БД: баланс, ім'я й картка
 * живуть там, і показувати їх зі своєї таблиці означало б показувати
 * вчорашній день.
 */
export const GuestPage = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const [guest, setGuest] = useState<Guest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!customerId) return;

    try {
      setGuest(await api.guest(customerId));
      setError(null);
    } catch (err) {
      setGuest(null);
      setError(
        err instanceof ApiError ? err.message : 'Не вдалося завантажити гостя',
      );
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="stack">
      <Link to="/guests" className="back-link">
        ← До списку гостей
      </Link>

      {isLoading && <p className="muted">Завантаження…</p>}

      {error && <div className="alert alert-error">{error}</div>}

      {guest && <GuestDetails guest={guest} onReload={load} />}
    </div>
  );
};
