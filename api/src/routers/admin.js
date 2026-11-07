import { Router } from 'express';

import {
  chargeOffController,
  getOperationsController,
  searchGuestController,
  topUpController,
} from '../controllers/guests.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validateBody.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { operationSchema } from '../validation/operations.js';

const router = Router();

// Усе під /api/admin — лише для авторизованих.
router.use(ctrlWrapper(authenticate));

router.get('/guests/search', ctrlWrapper(searchGuestController));

router.get(
  '/guests/:customerId/operations',
  ctrlWrapper(getOperationsController),
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
