import { Router } from 'express';

import {
  chargeOffController,
  getGuestController,
  getGuestsController,
  getOperationsController,
  getSyrveOperationsController,
  searchGuestController,
  topUpController,
} from '../controllers/guests.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validateBody.js';
import { validateQuery } from '../middlewares/validateQuery.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { guestsQuerySchema } from '../validation/guests.js';
import { operationSchema } from '../validation/operations.js';

const router = Router();

// Усе під /api/admin — лише для авторизованих.
router.use(ctrlWrapper(authenticate));

// Д2: список гостей із пошуком, сортуванням і пагінацією.
router.get(
  '/guests',
  validateQuery(guestsQuerySchema),
  ctrlWrapper(getGuestsController),
);

// Конкретні шляхи — ДО '/guests/:customerId', інакше 'search' потрапив би
// в параметр customerId.
router.get('/guests/search', ctrlWrapper(searchGuestController));

router.get('/guests/:customerId', ctrlWrapper(getGuestController));

// Наш журнал ручних операцій (хто з адміністраторів що зробив).
router.get(
  '/guests/:customerId/operations',
  ctrlWrapper(getOperationsController),
);

// Д1: усі зміни балансу в Syrve, включно з кабінетом і касою.
router.get(
  '/guests/:customerId/syrve-operations',
  ctrlWrapper(getSyrveOperationsController),
);

router.post(
  '/guests/:customerId/topup',
  validateBody(operationSchema),
  ctrlWrapper(topUpController),
);

router.post(
  '/guests/:customerId/chargeoff',
  validateBody(operationSchema),
  ctrlWrapper(chargeOffController),
);

export default router;
