import { AUDIT_ACTIONS, AUTH_COOKIE, JWT_TTL_SEC } from '../constants/index.js';
import { requestIp, writeAuditLog } from '../services/audit.js';
import { loginAdmin } from '../services/auth.js';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  // secure лише в проді: на localhost панель працює по http,
  // і secure-cookie браузер просто не збереже.
  secure: process.env.NODE_ENV === 'production',
  maxAge: JWT_TTL_SEC * 1000,
  path: '/',
};

export const loginController = async (req, res) => {
  let token;
  let admin;

  try {
    ({ token, admin } = await loginAdmin(req.body));
  } catch (error) {
    // Невдалий вхід теж подія журналу: за нею видно і помилку людини, і
    // перебір паролів. Адміністратора тут може не існувати взагалі, тому
    // в записі лишається введений логін.
    await writeAuditLog({
      login: req.body.login,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      details: { reason: error.message },
      ip: requestIp(req),
    });

    throw error;
  }

  res.cookie(AUTH_COOKIE, token, cookieOptions);

  await writeAuditLog({
    admin,
    action: AUDIT_ACTIONS.LOGIN,
    ip: requestIp(req),
  });

  res.json({
    status: 200,
    message: 'Вхід виконано',
    data: { admin },
  });
};

export const logoutController = async (req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: undefined });

  // req.admin є лише тоді, коли виходить справді авторизований: сам
  // /logout доступний без токена, щоб протухлу cookie можна було скинути.
  if (req.admin) {
    await writeAuditLog({
      admin: req.admin,
      action: AUDIT_ACTIONS.LOGOUT,
      ip: requestIp(req),
    });
  }

  res.json({ status: 200, message: 'Вихід виконано', data: null });
};

export const meController = async (req, res) => {
  res.json({
    status: 200,
    message: 'ok',
    data: { admin: req.admin },
  });
};
