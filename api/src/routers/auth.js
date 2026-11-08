import { Router } from 'express';

import { LOGIN_RATE_LIMIT } from '../constants/index.js';
import {
  loginController,
  logoutController,
  meController,
} from '../controllers/auth.js';
import {
  attachAdminIfPossible,
  authenticate,
} from '../middlewares/authenticate.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { validateBody } from '../middlewares/validateBody.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { loginSchema } from '../validation/auth.js';

const router = Router();

router.post(
  '/login',
  // Лімітер перед валідацією: перебір паролів не має навантажувати bcrypt.
  rateLimit({ keyPrefix: 'login', ...LOGIN_RATE_LIMIT }),
  validateBody(loginSchema),
  ctrlWrapper(loginController),
);

router.post(
  '/logout',
  ctrlWrapper(attachAdminIfPossible),
  ctrlWrapper(logoutController),
);

router.get('/me', ctrlWrapper(authenticate), ctrlWrapper(meController));

export default router;
