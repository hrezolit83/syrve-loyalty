import { PrismaClient } from '@prisma/client';

import { logger } from '../utils/logger.js';

// Один екземпляр на процес: PrismaClient тримає власний пул підключень,
// і кожен новий екземпляр відкривав би ще один.
export const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

// Явне підключення на старті: краще впасти одразу з понятною помилкою,
// ніж на першому запиті.
export const initPrismaConnection = async () => {
  await prisma.$connect();
  logger.info('PostgreSQL: підключення встановлено');
};

export const closePrismaConnection = async () => {
  await prisma.$disconnect();
};
