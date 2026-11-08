import { ScanLine, Search } from 'lucide-react';
import { useCallback, useState, type FormEvent } from 'react';

import { ApiError, api, type Guest } from '../api';
import { GuestDetails } from '../components/GuestDetails';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { CardForm, CardTitle } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { FormRow } from '../components/ui/FormRow';
import { Spinner } from '../components/ui/Spinner';
import styles from './SearchPage.module.css';

/**
 * Каса: пошук будь-якого гостя Syrve, нарахування і списання (О4, О5).
 *
 * Шукає в Syrve, тому знаходить і тих гостей, яких заводили на касі й які
 * ніколи не відкривали бота. Список гостей, зареєстрованих через бот, —
 * окремий розділ «Клієнти» (Д2), і він читається з нашої БД.
 *
 * Поле одне на телефон і на номер картки: касир сканує QR гостя
 * USB-сканером, а той вводить номер як клавіатура. Що саме ввели,
 * визначає сервер за формою рядка.
 */
export const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [guest, setGuest] = useState<Guest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSearching(true);

    try {
      setGuest(await api.searchGuest(query.trim()));
    } catch (err) {
      setGuest(null);
      setError(
        err instanceof ApiError ? err.message : 'Не вдалося виконати пошук',
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Після операції баланс змінився — перечитуємо гостя з Syrve за його id,
  // а не за тим, що ввели в поле: при пошуку за карткою телефону могло й
  // не бути, та й гість міг знайтися без нього.
  const refresh = useCallback(() => {
    if (!guest) return;

    api
      .guest(guest.customerId)
      .then(setGuest)
      .catch(() => setError('Не вдалося оновити дані гостя'));
  }, [guest]);

  return (
    <>
      <CardForm onSubmit={handleSearch}>
        <CardTitle>
          <ScanLine aria-hidden />
          Пошук гостя за телефоном або номером картки
        </CardTitle>
        <p className={styles.subtitle}>
          Пошук будь-якого гостя Syrve, нарахування і списання
        </p>

        <FormRow>
          <Field
            grow
            label="Телефон або номер картки"
            hint="Можна ввести номер з QR-коду гостя або сканером"
            type="text"
            inputMode="numeric"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="+380XXXXXXXXX або 7389451429"
            autoFocus
            required
          />

          <Button type="submit" disabled={isSearching}>
            {isSearching ? <Spinner /> : <Search aria-hidden="true" />}
            {isSearching ? 'Шукаємо…' : 'Знайти'}
          </Button>
        </FormRow>

        {error && <Alert>{error}</Alert>}
      </CardForm>

      {guest && <GuestDetails guest={guest} onReload={refresh} />}
    </>
  );
};
