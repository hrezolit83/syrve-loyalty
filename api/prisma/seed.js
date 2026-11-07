/**
 * Сід: створює адміністратора панелі з ADMIN_LOGIN / ADMIN_PASSWORD.
 *
 * Запуск: npm run seed (з папки api/).
 *
 * Пароль у .env, у базі — тільки bcrypt-хеш. upsert, тому повторний запуск
 * безпечний: існуючому адміну просто оновиться хеш.
 */
import bcrypt from 'bcrypt';

import { prisma } from '../src/db/prisma.js';
import { getEnvVar } from '../src/utils/getEnvVar.js';
import { BCRYPT_ROUNDS } from '../src/constants/index.js';

const main = async () => {
  const login = getEnvVar('ADMIN_LOGIN');
  const password = getEnvVar('ADMIN_PASSWORD');

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD має бути не коротшим за 8 символів');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const admin = await prisma.admin.upsert({
    where: { login },
    update: { passwordHash },
    create: { login, passwordHash },
  });

  // Логін у консоль можна, пароль і хеш — ні.
  console.log(`Адміністратора збережено: login=${admin.login}, id=${admin.id}`);
};

main()
  .catch((error) => {
    console.error(`Сід не виконано: ${error.message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
