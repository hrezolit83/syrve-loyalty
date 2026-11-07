/**
 * Типи транзакцій Syrve — в одному місці.
 *
 * Значення перевірені на живому API (див. docs/api-samples/
 * 11-customer-transactions-by_revision.json): Syrve віддає ЧИСЛОВИЙ код
 * у полі `type` і назву в `typeName`.
 *
 *   21 SetGuestCategory      — зміна категорії гостя, баланс не змінює
 *                              (sum = 0, balanceAfter = null)
 *   35 RefillWalletFromApi   — нарахування через API
 *   40 WithdrawWalletFromApi — списання через API
 *
 * Типів у Syrve більше (нарахування за чеком на касі, сертифікати,
 * скасування), їх коди ми ще не бачили. Тому порядок визначення такий:
 * назва → код → знак суми. Запасне правило за знаком гарантує, що
 * невідомий тип не зламає сповіщення: у Syrve нарахування додатне,
 * списання від'ємне.
 */

export const TRANSACTION_KINDS = {
  TOPUP: 'topup',
  CHARGEOFF: 'chargeoff',
  /** Не впливає на баланс — сповіщення не потрібне. */
  NEUTRAL: 'neutral',
};

/** Назва типу → категорія. Доповнювати тут, коли побачимо нові типи. */
export const TYPE_NAME_KINDS = {
  RefillWalletFromApi: TRANSACTION_KINDS.TOPUP,
  WithdrawWalletFromApi: TRANSACTION_KINDS.CHARGEOFF,
  SetGuestCategory: TRANSACTION_KINDS.NEUTRAL,
};

/** Числовий код → категорія. */
export const TYPE_CODE_KINDS = {
  21: TRANSACTION_KINDS.NEUTRAL,
  35: TRANSACTION_KINDS.TOPUP,
  40: TRANSACTION_KINDS.CHARGEOFF,
};

/**
 * @param {{type?: string|number|null, typeName?: string|null, sum: number}} transaction
 * @returns {'topup'|'chargeoff'|'neutral'}
 */
export const classifyTransaction = ({ type, typeName, sum }) => {
  if (typeName && TYPE_NAME_KINDS[typeName]) return TYPE_NAME_KINDS[typeName];

  const code = Number(type);

  if (Number.isFinite(code) && TYPE_CODE_KINDS[code]) {
    return TYPE_CODE_KINDS[code];
  }

  const amount = Number(sum);

  if (!amount) return TRANSACTION_KINDS.NEUTRAL;

  return amount > 0 ? TRANSACTION_KINDS.TOPUP : TRANSACTION_KINDS.CHARGEOFF;
};

/** Чи варто писати гостю про цю транзакцію. */
export const isNotifiable = (transaction) =>
  classifyTransaction(transaction) !== TRANSACTION_KINDS.NEUTRAL;
