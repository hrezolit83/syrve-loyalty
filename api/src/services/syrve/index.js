import { SYRVE_MODES } from '../../constants/index.js';
import { getEnvVar } from '../../utils/getEnvVar.js';
import { logger } from '../../utils/logger.js';
import { MockSyrveClient } from './mockClient.js';
import { RealSyrveClient } from './realClient.js';

export * from './errors.js';
export { SyrveClient } from './types.js';

/**
 * Фабрика клієнта Syrve.
 *
 * Один екземпляр на процес — у ньому живе кеш токена, організації й програми.
 * Решта коду імпортує getSyrveClient() і не знає, який режим активний.
 */
let client = null;

const createClient = () => {
  const mode = getEnvVar('SYRVE_MODE', SYRVE_MODES.MOCK).toLowerCase();

  if (mode === SYRVE_MODES.MOCK) {
    logger.info('Syrve: мок-режим (без доступу до Syrve)');
    return new MockSyrveClient();
  }

  if (mode !== SYRVE_MODES.REAL) {
    throw new Error(
      `Невідомий SYRVE_MODE="${mode}". Допустимі значення: real, mock`,
    );
  }

  logger.info('Syrve: справжній режим');

  return new RealSyrveClient({
    apiUrl: getEnvVar('SYRVE_API_URL', 'https://api-eu.syrve.live'),
    apiLogin: getEnvVar('SYRVE_API_LOGIN'),
    organizationId: process.env.SYRVE_ORGANIZATION_ID || null,
    programId: process.env.SYRVE_PROGRAM_ID || null,
  });
};

export const getSyrveClient = () => {
  if (!client) client = createClient();
  return client;
};

/** Лише для тестів: скинути кешований екземпляр. */
export const resetSyrveClient = () => {
  client = null;
};
