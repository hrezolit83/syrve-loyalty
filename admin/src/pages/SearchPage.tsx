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

/** Id підказки: поле посилається на неї через aria-describedby. */
const HINT_ID = 'cashier-search-hint';

/**
 * Каса: пошук будь-якого гостя Syrve, нарахування і списання (О4, О5).
 *
 * Шукає в Syrve, тому знаходить і тих гостей, яких заводили на касі й які
 * ніколи не відкривали бота. Список гостей, зареєстрованих через бот, —
 * окремий розділ «Клієнти» (Д2), і він читається з нашої БД.
 *
 * Поле одне на телефон і на номер картки: касир сканує QR гостя
 * USB-сканером, а той вводить номер як клавіатура й завершує Enter.
 * Форма відправляється саме по Enter — окремо тягтися до кнопки не
 * треба. Що саме ввели, визначає сервер за формою рядка.
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

        <FormRow
          hintId={HINT_ID}
          hint="QR-код гостя містить номер картки — його можна відсканувати USB-сканером на касі, номер введеться автоматично"
        >
          <Field
            grow
            label="Телефон або номер картки"
            aria-describedby={HINT_ID}
            type="text"
            inputMode="numeric"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="+380XXXXXXXXX або 10 цифр картки"
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
