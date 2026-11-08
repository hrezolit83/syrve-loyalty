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
  // За замовчуванням — усе. Журнал відповідає на питання «що взагалі
  // відбувалося»; відрізок за замовчуванням ховав би події старші за
  // тиждень, і порожній список виглядав би як «нічого не було».
  period: Joi.string().valid('today', '7d', '30d', 'all').default('all'),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(AUDIT_PAGE_SIZE),
});
