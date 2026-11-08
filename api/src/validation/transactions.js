import Joi from 'joi';

import { TRANSACTIONS_LIST_PAGE_SIZE } from '../constants/index.js';

/**
 * Фільтри журналу транзакцій. Період і тип — із білого списку: вони
 * потрапляють у межі запиту до БД.
 */
export const transactionsQuerySchema = Joi.object({
  period: Joi.string().valid('today', '7d', '30d', 'all').default('all'),
  type: Joi.string().valid('topup', 'chargeoff').allow('').default(''),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(TRANSACTIONS_LIST_PAGE_SIZE),
});

/** Експорт бере ті самі фільтри, але без пагінації. */
export const transactionsExportQuerySchema = Joi.object({
  period: Joi.string().valid('today', '7d', '30d', 'all').default('all'),
  type: Joi.string().valid('topup', 'chargeoff').allow('').default(''),
});
