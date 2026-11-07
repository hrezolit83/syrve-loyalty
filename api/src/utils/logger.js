import pino from 'pino';

import { getEnvVar } from './getEnvVar.js';

const level = getEnvVar('LOG_LEVEL', 'info');
const pretty = getEnvVar('LOG_PRETTY', 'false') === 'true';

/**
 * Один логер на процес. Секрети в лог не пишемо ніколи, але redact —
 * страховка на випадок, коли в лог поїде цілий об'єкт запиту чи конфіг.
 */
export const logger = pino({
  level,
  redact: {
    paths: [
      'apiLogin',
      'token',
      'password',
      'passwordHash',
      'req.headers.authorization',
      'req.headers.cookie',
      '*.apiLogin',
      '*.token',
      '*.password',
    ],
    censor: '<redacted>',
  },
  ...(pretty
    ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
    : {}),
});
