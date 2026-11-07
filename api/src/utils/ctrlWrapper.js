/**
 * Обгортка контролера: будь-яка помилка в async-обробнику їде в next(),
 * а не стає unhandled rejection. Express 5 це вміє сам, але обгортка
 * залишається для єдиного стилю з рештою коду.
 */
export const ctrlWrapper = (controller) => {
  return async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (err) {
      next(err);
    }
  };
};
