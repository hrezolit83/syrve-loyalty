import { Router } from 'express';

import { getHealthController } from '../controllers/health.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';

const router = Router();

// GET /api/health — застосунок живий і бачить базу.
router.get('/', ctrlWrapper(getHealthController));

export default router;
