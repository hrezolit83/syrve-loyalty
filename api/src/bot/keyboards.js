import { Keyboard } from 'grammy';

export const BUTTONS = {
  SHARE_CONTACT: '📱 Надіслати контакт',
  MY_CARD: '💳 Моя картка',
  REFRESH_BALANCE: '🔄 Оновити баланс',
};

/** Кнопка запиту контакту: номер Telegram підтверджує сам. */
export const contactKeyboard = new Keyboard()
  .requestContact(BUTTONS.SHARE_CONTACT)
  .resized()
  .oneTime();

/** Постійна клавіатура зареєстрованого гостя. */
export const menuKeyboard = new Keyboard()
  .text(BUTTONS.MY_CARD)
  .row()
  .text(BUTTONS.REFRESH_BALANCE)
  .resized()
  .persistent();
