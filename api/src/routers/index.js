import { Router } from 'express';

import adminRouter from './admin.js';
import authRouter from './auth.js';
import healthRouter from './health.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/admin', adminRouter);

export default router;
