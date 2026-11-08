import bcrypt from 'bcrypt';
import createHttpError from 'http-errors';

import { ADMIN_ROLES, BCRYPT_ROUNDS } from '../constants/index.js';
import { prisma } from '../db/prisma.js';

/**
 * Керування адміністраторами панелі (Д10). Доступне лише власнику.
 *
 * Адміністраторів не видаляємо, а деактивуємо: на них посилаються журнал
 * операцій і журнал дій, і видалення або стерло б історію, або лишило б
 * у ній «невідомо хто».
 */

const PUBLIC_FIELDS = {
  id: true,
  login: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export const getAdmins = async () =>
  prisma.admin.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    select: PUBLIC_FIELDS,
  });

export const createAdmin = async ({ login, password, role }) => {
  const existing = await prisma.admin.findUnique({ where: { login } });

  if (existing) {
    throw createHttpError(409, 'Адміністратор із таким логіном уже існує');
  }

  return prisma.admin.create({
    data: {
      login,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: role ?? ADMIN_ROLES.MANAGER,
    },
    select: PUBLIC_FIELDS,
  });
};

const getOrFail = async (id) => {
  const admin = await prisma.admin.findUnique({
    where: { id },
    select: PUBLIC_FIELDS,
  });

  if (!admin) throw createHttpError(404, 'Адміністратора не знайдено');

  return admin;
};

/**
 * Зміна ролі та активності.
 *
 * Два запобіжники проти того, щоб власник зачинив себе зовні: не можна
 * ні забрати собі роль owner, ні деактивувати себе. Інакше єдиний власник
 * одним кліком лишив би заклад без доступу до керування адміністраторами —
 * і повернути його можна було б тільки сідом із .env.
 */
export const updateAdmin = async ({ id, actorId, role, isActive }) => {
  const admin = await getOrFail(id);

  if (id === actorId && role !== undefined && role !== ADMIN_ROLES.OWNER) {
    throw createHttpError(409, 'Не можна забрати роль власника в самого себе');
  }

  if (id === actorId && isActive === false) {
    throw createHttpError(409, 'Не можна деактивувати власний обліковий запис');
  }

  return prisma.admin.update({
    where: { id: admin.id },
    data: {
      ...(role !== undefined ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
    select: PUBLIC_FIELDS,
  });
};

export const resetAdminPassword = async ({ id, password }) => {
  const admin = await getOrFail(id);

  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
  });

  return admin;
};
