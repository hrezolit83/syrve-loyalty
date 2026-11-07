import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';

import router from './routers/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { getEnvVar } from './utils/getEnvVar.js';
import { logger } from './utils/logger.js';

const PORT = Number(getEnvVar('PORT', '3000'));

export const setupServer = async () => {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get('/', (req, res) => {
    res.json({
      status: 200,
      message: 'Syrve Loyalty API працює',
      data: null,
    });
  });

  app.use('/api', router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = app.listen(PORT, () => {
    logger.info(`HTTP-сервер слухає порт ${PORT}`);
  });

  // app.listen асинхронний, тому помилку порту ловимо подією 'error':
  // у try/catch вона не потрапить.
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Порт ${PORT} уже зайнятий`);
    } else {
      logger.error({ err }, 'Не вдалося запустити сервер');
    }
    process.exit(1);
  });

  return server;
};
