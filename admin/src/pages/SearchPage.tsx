import { useCallback, useState, type FormEvent } from 'react';

import { ApiError, api, type Guest } from '../api';
import { GuestDetails } from '../components/GuestDetails';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { CardForm, CardTitle } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { FormRow } from '../components/ui/FormRow';

/**
 * Пошук гостя за телефоном (О4).
 *
 * Шукає в Syrve, тому знаходить і тих гостей, які ніколи не відкривали бота
 * (їх заводили на касі). Список гостей, зареєстрованих через бот, —
 * окрема сторінка (Д2).
 */
export const SearchPage = () => {
  const [phone, setPhone] = useState('');
  const [guest, setGuest] = useState<Guest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const loadGuest = useCallback(async (phoneValue: string) => {
    setGuest(await api.searchGuest(phoneValue));
  }, []);

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSearching(true);

    try {
      await loadGuest(phone.trim());
    } catch (err) {
      setGuest(null);
      setError(
        err instanceof ApiError ? err.message : 'Не вдалося виконати пошук',
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Після операції баланс змінився — перечитуємо гостя з Syrve.
  const refresh = useCallback(() => {
    if (!guest) return;

    loadGuest(guest.phone).catch(() => {
      setError('Не вдалося оновити дані гостя');
    });
  }, [guest, loadGuest]);

  return (
    <>
      <CardForm onSubmit={handleSearch}>
        <CardTitle>Пошук гостя за телефоном</CardTitle>

        <FormRow>
          <Field
            grow
            label="Телефон"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+380XXXXXXXXX або 0XXXXXXXXX"
            autoFocus
            required
          />

          <Button type="submit" disabled={isSearching}>
            {isSearching ? 'Шукаємо…' : 'Знайти'}
          </Button>
        </FormRow>

        {error && <Alert>{error}</Alert>}
      </CardForm>

      {guest && <GuestDetails guest={guest} onReload={refresh} />}
    </>
  );
};
