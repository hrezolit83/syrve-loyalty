import Joi from 'joi';

import { GUESTS_PAGE_SIZE } from '../constants/index.js';

/**
 * Параметри списку гостей (Д2).
 *
 * Валідуємо саме query: сортування підставляється в запит до БД, тому
 * допустимі значення мають бути з білого списку, а не з рядка користувача.
 */
export const guestsQuerySchema = Joi.object({
  search: Joi.string().trim().allow('').max(100).default(''),
  sort: Joi.string().valid('createdAt', 'name').default('createdAt'),
  order: Joi.string().valid('asc', 'desc').default('desc'),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(GUESTS_PAGE_SIZE),
});
