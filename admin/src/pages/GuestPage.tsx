import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError, api, type Guest } from '../api';
import { GuestDetails } from '../components/GuestDetails';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import styles from './GuestPage.module.css';

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
    <>
      <Link to="/guests" className={styles.backLink}>
        ← До списку гостей
      </Link>

      {isLoading && (
        <p className={styles.loading}>
          <Spinner />
          Завантаження…
        </p>
      )}

      {error && <Alert>{error}</Alert>}

      {guest && <GuestDetails guest={guest} onReload={load} />}
    </>
  );
};
