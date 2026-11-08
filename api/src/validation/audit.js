import Joi from 'joi';

import { AUDIT_ACTIONS, AUDIT_PAGE_SIZE } from '../constants/index.js';

/**
 * Фільтри журналу дій. Дія — з білого списку: значення йде в запит до БД,
 * і довільний рядок тут ні до чого.
 */
export const auditQuerySchema = Joi.object({
  adminId: Joi.string().uuid().allow('').default(''),
  action: Joi.string()
    .valid(...Object.values(AUDIT_ACTIONS))
    .allow('')
    .default(''),
  period: Joi.string().valid('today', '7d', '30d', 'all').default('7d'),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(AUDIT_PAGE_SIZE),
});
