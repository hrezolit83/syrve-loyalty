import createHttpError from 'http-errors';

import { AUTH_COOKIE } from '../constants/index.js';
import { findAdminById, verifyToken } from '../services/auth.js';

/**
 * Пускає далі лише з валідним JWT із httpOnly cookie.
 * Адміна дочитуємо з БД: якщо його видалили, старий токен має перестати діяти.
 */
export const authenticate = async (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE];

  if (!token) {
    next(createHttpError(401, 'Потрібна авторизація'));
    return;
  }

  const payload = verifyToken(token);

  if (!payload?.sub) {
    next(createHttpError(401, 'Сесія недійсна або закінчилася'));
    return;
  }

  const admin = await findAdminById(payload.sub);

  if (!admin) {
    next(createHttpError(401, 'Адміністратора не знайдено'));
    return;
  }

  req.admin = admin;
  next();
};
