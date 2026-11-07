import { AUTH_COOKIE, JWT_TTL_SEC } from '../constants/index.js';
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
  const { token, admin } = await loginAdmin(req.body);

  res.cookie(AUTH_COOKIE, token, cookieOptions);

  res.json({
    status: 200,
    message: 'Вхід виконано',
    data: { admin },
  });
};

export const logoutController = async (req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: undefined });

  res.json({ status: 200, message: 'Вихід виконано', data: null });
};

export const meController = async (req, res) => {
  res.json({
    status: 200,
    message: 'ok',
    data: { admin: req.admin },
  });
};
