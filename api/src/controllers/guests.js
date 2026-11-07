import createHttpError from 'http-errors';

import { ADMIN_HISTORY_LIMIT } from '../constants/index.js';

import { prisma } from '../db/prisma.js';
import {
  applyOperation,
  getOperationsByCustomerId,
} from '../services/operations.js';
import { getGuestList } from '../services/guestList.js';
import { getGuestSyrveHistory } from '../services/history.js';
import { getSyrveClient } from '../services/syrve/index.js';
import { formatAmount } from '../templates/messages.js';
import { logger } from '../utils/logger.js';
import { formatPhone, normalizePhone } from '../utils/phone.js';

/**
 * Пошук гостя за телефоном (О4).
 *
 * Шукаємо в Syrve — він джерело правди про гостя, картку й баланс.
 * У своїй базі лише дивимось, чи є в нього Telegram: адміністратору корисно
 * знати, чи дійде до гостя сповіщення про нарахування.
 */
/** Картка гостя: дані з Syrve + позначка, чи є в нього наш Telegram. */
const buildGuestCard = async (customer, fallbackPhone = null) => {
  const guest = await prisma.guest.findUnique({
    where: { syrveCustomerId: customer.id },
    select: { id: true, cardNumber: true, createdAt: true, botBlockedAt: true },
  });

  const phone = customer.phone ?? fallbackPhone;

  return {
    customerId: customer.id,
    name: customer.name,
    phone,
    phoneFormatted: formatPhone(phone),
    cardNumber:
      customer.cards[0]?.number ??
      customer.cards[0]?.track ??
      guest?.cardNumber ??
      null,
    balance: customer.balance,
    registeredViaBot: Boolean(guest),
    registeredAt: guest?.createdAt ?? null,
    botBlocked: guest?.botBlockedAt ? true : false,
  };
};

export const searchGuestController = async (req, res) => {
  const phone = normalizePhone(req.query.phone);

  if (!phone) {
    throw createHttpError(
      400,
      'Вкажіть телефон у форматі +380XXXXXXXXX або 0XXXXXXXXX',
    );
  }

  const customer = await getSyrveClient().findCustomerByPhone(phone);

  if (!customer) {
    throw createHttpError(404, 'Гостя з таким телефоном не знайдено');
  }

  res.json({
    status: 200,
    message: 'ok',
    data: await buildGuestCard(customer, phone),
  });
};

/**
 * Та сама картка, але за id гостя в Syrve — потрібна для переходу
 * зі списку гостей (Д2), де телефону може й не бути.
 */
export const getGuestController = async (req, res) => {
  const customer = await getSyrveClient().findCustomerById(
    req.params.customerId,
  );

  if (!customer) {
    throw createHttpError(404, 'Гостя не знайдено в Syrve');
  }

  res.json({
    status: 200,
    message: 'ok',
    data: await buildGuestCard(customer),
  });
};

/** Д2: список гостей, зареєстрованих через бот. */
export const getGuestsController = async (req, res) => {
  const result = await getGuestList(req.validatedQuery);

  res.json({ status: 200, message: 'ok', data: result });
};

const operationController = (type) => async (req, res) => {
  const { customerId } = req.params;
  const { amount, reason } = req.body;

  logger.info(
    { adminId: req.admin.id, customerId, type, amount },
    'Запит на операцію з бонусами',
  );

  const result = await applyOperation({
    type,
    adminId: req.admin.id,
    syrveCustomerId: customerId,
    amount,
    reason,
  });

  res.json({
    status: 200,
    message:
      type === 'topup'
        ? `Нараховано ${formatAmount(amount)}. Новий баланс: ${formatAmount(result.balance)}`
        : `Списано ${formatAmount(amount)}. Новий баланс: ${formatAmount(result.balance)}`,
    data: result,
  });
};

export const topUpController = operationController('topup');
export const chargeOffController = operationController('chargeoff');

/**
 * Д1: усі зміни балансу гостя з Syrve — зокрема ті, що зробили в кабінеті
 * Syrve Loyalty або на касі. Це НЕ наш журнал ручних операцій: той показує,
 * хто з адміністраторів що зробив через панель, і містить також невдалі
 * спроби. Тому в панелі два окремі блоки.
 */
export const getSyrveOperationsController = async (req, res) => {
  const operations = await getGuestSyrveHistory(
    req.params.customerId,
    ADMIN_HISTORY_LIMIT,
  );

  res.json({ status: 200, message: 'ok', data: { operations } });
};

export const getOperationsController = async (req, res) => {
  const operations = await getOperationsByCustomerId(req.params.customerId);

  res.json({ status: 200, message: 'ok', data: { operations } });
};
