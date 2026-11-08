import { CARD_NUMBER_LENGTH } from '../constants/index.js';
import { normalizePhone } from './phone.js';

/**
 * Одне поле пошуку на касі приймає і телефон, і номер картки.
 *
 * Розрізняються вони за формою, і випадків перетину немає: наші картки —
 * рівно 10 цифр, які генеруються без провідного нуля, а український
 * мобільний із 10 цифр завжди починається з нуля (0XX…). Решта довжин
 * (9 або 12 цифр) — теж телефон.
 *
 * Навіщо одне поле: касир сканує QR гостя USB-сканером, а той вводить
 * номер картки як клавіатура — вибирати тип руками означало б робити
 * зайвий клік на кожного гостя.
 *
 * @returns {{kind: 'card', value: string}|{kind: 'phone', value: string}|null}
 *   null — рядок не схожий ні на картку, ні на телефон.
 */
export const classifySearchTerm = (input) => {
  const digits = String(input ?? '').replace(/\D/g, '');

  if (digits.length === CARD_NUMBER_LENGTH && !digits.startsWith('0')) {
    return { kind: 'card', value: digits };
  }

  const phone = normalizePhone(input);

  return phone ? { kind: 'phone', value: phone } : null;
};
