import createHttpError from 'http-errors';

/**
 * Пускає далі лише адміністраторів із потрібною роллю.
 *
 * Права перевіряються ТУТ, на сервері. Панель теж ховає недоступні
 * розділи, але це зручність, а не захист: сторінку можна відкрити за
 * прямим посиланням, а запит — надіслати повз неї будь-яким curl.
 *
 * Ставиться після authenticate: без req.admin ролі немає звідки взяти.
 */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.admin) {
      next(createHttpError(401, 'Потрібна авторизація'));
      return;
    }

    if (!roles.includes(req.admin.role)) {
      next(createHttpError(403, 'Недостатньо прав для цієї дії'));
      return;
    }

    next();
  };
