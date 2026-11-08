import createHttpError from 'http-errors';

import { AUTH_COOKIE } from '../constants/index.js';
import { findAdminById, verifyToken } from '../services/auth.js';

/**
 * Пускає далі лише з валідним JWT із httpOnly cookie.
 *
 * Адміна дочитуємо з БД на кожен запит. Через це деактивація діє одразу:
 * токен у людини лишається валідним за підписом, але наступний же запит
 * упирається в isActive і сесія вмирає. Якби роль і активність бралися
 * з токена, деактивований працівник мав би доступ до кінця строку JWT —
 * до 12 годин.
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

  if (!admin.isActive) {
    next(createHttpError(403, 'Доступ вимкнено. Зверніться до власника.'));
    return;
  }

  req.admin = admin;
  next();
};

/**
 * М'який варіант: підставляє req.admin, якщо токен справний, і мовчки
 * пропускає далі, якщо ні.
 *
 * Потрібен для /logout: вихід має працювати навіть із протухлою cookie
 * (інакше її нічим скинути), але коли сесія ще жива — у журналі дій
 * має лишитися, хто саме вийшов.
 */
export const attachAdminIfPossible = async (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE];
  const payload = token ? verifyToken(token) : null;

  if (payload?.sub) {
    const admin = await findAdminById(payload.sub);

    if (admin?.isActive) req.admin = admin;
  }

  next();
};
