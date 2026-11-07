import { Router } from 'express';

import {
  getHealthController,
  getSyrveHealthController,
} from '../controllers/health.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';

const router = Router();

// GET /api/health — застосунок живий і бачить базу.
router.get('/', ctrlWrapper(getHealthController));

// GET /api/health/syrve — О1: токен, організація, програма.
router.get('/syrve', ctrlWrapper(getSyrveHealthController));

export default router;
