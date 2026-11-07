/**
 * Нормалізація телефону до +380XXXXXXXXX.
 *
 * Чому один формат: телефон — ключ пошуку гостя і в Syrve, і в нашій БД
 * (unique). Якщо той самий номер зберегти як "0991234567" і "+380991234567",
 * з'явиться дубль гостя.
 *
 * Telegram у contact.phone_number віддає номер без плюса ("380991234567"),
 * адміністратор у панелі може ввести будь-який із звичних варіантів.
 */

/** @returns {string|null} null — номер не схожий на український */
export const normalizePhone = (input) => {
  if (!input) return null;

  const digits = String(input).replace(/\D/g, '');

  // 380XXXXXXXXX — як надсилає Telegram
  if (digits.length === 12 && digits.startsWith('380')) {
    return `+${digits}`;
  }

  // 0XXXXXXXXX — як пишуть в Україні
  if (digits.length === 10 && digits.startsWith('0')) {
    return `+38${digits}`;
  }

  // XXXXXXXXX — без коду країни й без нуля
  if (digits.length === 9) {
    return `+380${digits}`;
  }

  return null;
};

/** Телефон у вигляді +380 (99) 123-45-67 — для показу адміністратору. */
export const formatPhone = (phone) => {
  const digits = String(phone ?? '').replace(/\D/g, '');

  if (digits.length !== 12) return phone ?? '';

  return `+${digits.slice(0, 3)} (${digits.slice(3, 5)}) ${digits.slice(
    5,
    8,
  )}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`;
};
