/**
 * Типи транзакцій Syrve — в одному місці.
 *
 * Значення перевірені на живому API (`docs/api-samples/11-...json`) і ручною
 * перевіркою через кабінет Syrve Loyalty. Syrve віддає ЧИСЛОВИЙ код у полі
 * `type` і назву в `typeName`:
 *
 *   | код | typeName               | звідки приходить                       |
 *   |-----|------------------------|----------------------------------------|
 *   |   7 | RefillWallet           | зміна балансу з кабінету Syrve Loyalty |
 *   |  21 | SetGuestCategory       | зміна категорії гостя, баланс не чіпає |
 *   |  35 | RefillWalletFromApi    | нарахування через API (наша панель)    |
 *   |  40 | WithdrawWalletFromApi  | списання через API (наша панель)       |
 *
 * ГОЛОВНЕ ПРАВИЛО: напрямок операції визначає ЗНАК СУМИ, а не тип.
 * У Syrve нарахування додатне, списання від'ємне — це видно в усіх
 * перевірених типах. Таблиця нижче відповідає лише на інше питання:
 * чи ця транзакція взагалі змінює баланс.
 *
 * Чому саме так: типів у Syrve більше, ніж ми бачили (сертифікати,
 * нарахування за чеком на касі, скасування, коригування), і кожен новий код
 * інакше вимагав би правки коду. За знаком суми невідомий тип одразу
 * обробляється правильно — гість отримає «Нараховано» чи «Списано» залежно
 * від того, що насправді сталося з його балансом.
 */

export const TRANSACTION_KINDS = {
  TOPUP: 'topup',
  CHARGEOFF: 'chargeoff',
  /** Не впливає на баланс — сповіщення не потрібне. */
  NEUTRAL: 'neutral',
};

/**
 * Типи, які НЕ змінюють баланс. Тільки вони виключають сповіщення —
 * решта (включно з невідомими) вирішується за сумою.
 */
export const NEUTRAL_TYPE_NAMES = new Set(['SetGuestCategory']);
export const NEUTRAL_TYPE_CODES = new Set([21]);

/** Відомі типи зміни балансу — для читабельності журналу, не для напрямку. */
export const BALANCE_TYPE_NAMES = {
  RefillWallet: 'зміна балансу з кабінету Syrve Loyalty',
  RefillWalletFromApi: 'нарахування через API',
  WithdrawWalletFromApi: 'списання через API',
};

/**
 * @param {{type?: string|number|null, typeName?: string|null, sum: number}} transaction
 * @returns {'topup'|'chargeoff'|'neutral'}
 */
export const classifyTransaction = ({ type, typeName, sum }) => {
  if (typeName && NEUTRAL_TYPE_NAMES.has(typeName)) {
    return TRANSACTION_KINDS.NEUTRAL;
  }

  const code = Number(type);

  if (Number.isFinite(code) && NEUTRAL_TYPE_CODES.has(code)) {
    return TRANSACTION_KINDS.NEUTRAL;
  }

  const amount = Number(sum);

  // Нуль або не число — балансу не стосується, писати гостю нема про що.
  if (!Number.isFinite(amount) || amount === 0) {
    return TRANSACTION_KINDS.NEUTRAL;
  }

  // Напрямок — виключно за знаком суми.
  return amount > 0 ? TRANSACTION_KINDS.TOPUP : TRANSACTION_KINDS.CHARGEOFF;
};

/** Чи варто писати гостю про цю транзакцію. */
export const isNotifiable = (transaction) =>
  classifyTransaction(transaction) !== TRANSACTION_KINDS.NEUTRAL;
