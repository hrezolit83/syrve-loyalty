import Joi from 'joi';

/**
 * Період статистики (Д9). Білий список, бо значення потрапляє в межі
 * запиту до БД — довільний рядок сюди пускати не можна.
 */
export const statsQuerySchema = Joi.object({
  period: Joi.string().valid('today', '7d', '30d', 'all').default('7d'),
});
