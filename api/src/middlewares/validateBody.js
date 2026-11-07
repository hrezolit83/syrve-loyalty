import createHttpError from 'http-errors';

/**
 * Валідація тіла запиту схемою Joi. abortEarly: false — щоб клієнт
 * отримав усі помилки одразу, а не по одній.
 */
export const validateBody = (schema) => async (req, res, next) => {
  try {
    req.body = await schema.validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    next();
  } catch (err) {
    next(
      createHttpError(400, 'Некоректні дані запиту', {
        errors: err.details?.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      }),
    );
  }
};
