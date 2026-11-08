import bcrypt from 'bcrypt';
import createHttpError from 'http-errors';
import jwt from 'jsonwebtoken';

import { JWT_TTL_SEC } from '../constants/index.js';
import { prisma } from '../db/prisma.js';
import { getEnvVar } from '../utils/getEnvVar.js';

/**
 * Автентифікація адміністратора панелі.
 *
 * JWT, а не сесії в БД: панель — єдиний клієнт, перевірка підпису не вимагає
 * запиту до бази. Токен їде в httpOnly cookie, тому недоступний JS на
 * сторінці (захист від XSS-викрадення).
 */

export const loginAdmin = async ({ login, password }) => {
  const admin = await prisma.admin.findUnique({ where: { login } });

  // Однаковий текст і для невідомого логіна, і для неправильного пароля:
  // інакше можна перебором з'ясувати, які логіни існують.
  const invalid = createHttpError(401, 'Невірний логін або пароль');

  if (!admin) {
    // Порівняння все одно виконуємо, щоб час відповіді не виказував,
    // чи існує логін.
    await bcrypt.compare(password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    throw invalid;
  }

  const isEqual = await bcrypt.compare(password, admin.passwordHash);

  if (!isEqual) throw invalid;

  // Деактивованого не пускаємо. Текст інший, ніж у «невірний логін або
  // пароль»: тут уже доведено, що це свій, і приховувати нема чого —
  // людині треба зрозуміти, що річ не в паролі.
  if (!admin.isActive) {
    throw createHttpError(403, 'Доступ вимкнено. Зверніться до власника.');
  }

  const token = jwt.sign(
    { sub: admin.id, login: admin.login },
    getEnvVar('JWT_SECRET'),
    { expiresIn: JWT_TTL_SEC },
  );

  return {
    token,
    admin: { id: admin.id, login: admin.login, role: admin.role },
  };
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, getEnvVar('JWT_SECRET'));
  } catch {
    return null;
  }
};

export const findAdminById = async (id) =>
  prisma.admin.findUnique({
    where: { id },
    select: {
      id: true,
      login: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
