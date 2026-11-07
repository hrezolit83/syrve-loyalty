import createHttpError from 'http-errors';

/**
 * Валідація query-параметрів. Окремо від validateBody, бо тут потрібні
 * значення за замовчуванням і приведення типів: `?page=2` приходить рядком.
 */
export const validateQuery = (schema) => async (req, res, next) => {
  try {
    req.validatedQuery = await schema.validateAsync(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    next();
  } catch (err) {
    next(
      createHttpError(400, 'Некоректні параметри запиту', {
        errors: err.details?.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      }),
    );
  }
};
