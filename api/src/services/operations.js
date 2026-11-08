import createHttpError from 'http-errors';

import { OPERATION_LOCK_TIMEOUT_MS } from '../constants/index.js';
import { prisma } from '../db/prisma.js';
import { formatAmount } from '../templates/messages.js';
import { logger } from '../utils/logger.js';
import {
  getSyrveClient,
  SyrveNotFoundError,
  SyrveUnavailableError,
  SyrveValidationError,
} from './syrve/index.js';

/**
 * Ручні нарахування і списання (О5).
 *
 * Два правила, які тут головні:
 *
 * 1. Списати більше, ніж є на балансі, не можна. Баланс перевіряємо
 *    безпосередньо перед операцією через customer/info — не з кешу й не з
 *    нашої БД, бо баланс живе в Syrve і міг змінитися на касі секунду тому.
 *
 * 2. Захист від гонки. Без нього два одночасні списання по 100 з балансу 150
 *    обидва пройшли б перевірку й баланс став би -50.
 *    Беремо pg_advisory_xact_lock за id гостя: лок тримається до кінця
 *    транзакції БД і автоматично знімається навіть при падінні процесу
 *    (на відміну від ручного лока в Redis, який треба не забути віддати).
 */

const TYPE_LABELS = {
  topup: 'нарахування',
  chargeoff: 'списання',
};

/** Журнал пишемо завжди — і на успіх, і на відмову. */
const writeOperation = async ({
  adminId,
  syrveCustomerId,
  guestId,
  type,
  amount,
  reason,
  status,
  error,
}) =>
  prisma.operation.create({
    data: {
      adminId,
      syrveCustomerId,
      guestId: guestId ?? null,
      type,
      amount,
      reason,
      status,
      error: error ?? null,
    },
  });

/**
 * Перетворює помилку Syrve на HTTP-помилку з українським текстом.
 * Текст від Syrve користувачу не віддаємо (у ньому буває apiLogin).
 */
const toHttpError = (error, type) => {
  if (error instanceof SyrveNotFoundError) {
    return createHttpError(404, 'Гостя не знайдено в Syrve');
  }

  if (error instanceof SyrveUnavailableError) {
    return createHttpError(
      503,
      'Syrve тимчасово недоступний, операцію не виконано',
    );
  }

  if (error instanceof SyrveValidationError) {
    return createHttpError(
      409,
      `Syrve відхилив ${TYPE_LABELS[type]} — перевірте дані операції`,
    );
  }

  return createHttpError(502, `Не вдалося виконати ${TYPE_LABELS[type]}`);
};

/**
 * @param {'topup'|'chargeoff'} type
 */
export const applyOperation = async ({
  type,
  adminId,
  syrveCustomerId,
  amount,
  reason,
  /** Межа однієї операції для цього адміністратора; null — без межі. */
  amountLimit = null,
}) => {
  const client = getSyrveClient();

  const guest = await prisma.guest.findUnique({
    where: { syrveCustomerId },
    select: { id: true },
  });

  const logFailure = async (message) => {
    await writeOperation({
      adminId,
      syrveCustomerId,
      guestId: guest?.id,
      type,
      amount,
      reason,
      status: 'failed',
      error: message,
    });
  };

  // Ліміт перевіряємо до будь-яких запитів у Syrve, але після того, як
  // стало куди писати відмову: перевищення межі теж має лишитися в
  // журналі гостя, інакше в історії буде дірка.
  if (amountLimit !== null && amount > amountLimit) {
    const message = `Перевищено ліміт на одну операцію: ${formatAmount(
      amountLimit,
    )} бонусів`;

    await logFailure(message);

    throw createHttpError(403, message);
  }

  let result;

  try {
    result = await prisma.$transaction(
      async (tx) => {
        // Лок за гостем: решта операцій по цьому ж гостю чекають тут.
        // hashtext — бо advisory-лок приймає числа, а id у нас uuid.
        // $executeRaw, а не $queryRaw: функція повертає void, і $queryRaw
        // падає на спробі десеріалізувати порожню колонку.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${syrveCustomerId}))`;

        const customer = await client.findCustomerById(syrveCustomerId);

        if (!customer) {
          throw createHttpError(404, 'Гостя не знайдено в Syrve');
        }

        if (type === 'chargeoff' && customer.balance < amount) {
          throw createHttpError(
            409,
            `Недостатньо бонусів: на балансі ${formatAmount(
              customer.balance,
            )}, списати ${formatAmount(amount)}`,
          );
        }

        const walletId = customer.walletId;

        if (type === 'topup') {
          await client.topUpWallet({
            customerId: syrveCustomerId,
            walletId,
            sum: amount,
            comment: reason,
          });
        } else {
          await client.chargeOffWallet({
            customerId: syrveCustomerId,
            walletId,
            sum: amount,
            comment: reason,
          });
        }

        return { balanceBefore: customer.balance };
      },
      {
        // Усередині транзакції є запити до Syrve, тому дефолтних 5 с мало.
        timeout: OPERATION_LOCK_TIMEOUT_MS,
        maxWait: OPERATION_LOCK_TIMEOUT_MS,
      },
    );
  } catch (error) {
    // Журнал пишемо ПОЗА транзакцією: усередині він відкотився б разом
    // з нею, і невдала спроба не залишила б слідів.
    const httpError = error.status ? error : toHttpError(error, type);

    await logFailure(httpError.message);

    logger.warn(
      {
        syrveCustomerId,
        type,
        amount,
        err: { name: error.name, message: error.message },
        details: error.details ?? null,
      },
      'Операцію не виконано',
    );

    throw httpError;
  }

  const operation = await writeOperation({
    adminId,
    syrveCustomerId,
    guestId: guest?.id,
    type,
    amount,
    reason,
    status: 'success',
  });

  // Баланс перечитуємо з Syrve: він — джерело правди.
  const customer = await client.findCustomerById(syrveCustomerId);

  logger.info(
    { syrveCustomerId, type, amount, balance: customer?.balance },
    'Операцію виконано',
  );

  return {
    operationId: operation.id,
    type,
    amount,
    reason,
    balanceBefore: result.balanceBefore,
    balance: customer?.balance ?? null,
    createdAt: operation.createdAt,
  };
};

/** Журнал операцій гостя — для панелі (О5) і як основа для Д1. */
export const getOperationsByCustomerId = async (syrveCustomerId, limit = 50) => {
  const operations = await prisma.operation.findMany({
    where: { syrveCustomerId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { admin: { select: { login: true } } },
  });

  return operations.map((operation) => ({
    id: operation.id,
    type: operation.type,
    amount: Number(operation.amount),
    reason: operation.reason,
    status: operation.status,
    error: operation.error,
    adminLogin: operation.admin.login,
    createdAt: operation.createdAt,
  }));
};
