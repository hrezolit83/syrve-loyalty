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
import {
  createAdminController,
  getAdminsController,
  resetAdminPasswordController,
  updateAdminController,
} from '../controllers/admins.js';
import { getAuditController } from '../controllers/audit.js';
import { getStatsController } from '../controllers/stats.js';
import {
  exportTransactionsController,
  getTransactionsController,
} from '../controllers/transactions.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validateBody } from '../middlewares/validateBody.js';
import { validateQuery } from '../middlewares/validateQuery.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import {
  createAdminSchema,
  resetPasswordSchema,
  updateAdminSchema,
} from '../validation/admins.js';
import { auditQuerySchema } from '../validation/audit.js';
import { guestsQuerySchema } from '../validation/guests.js';
import { operationSchema } from '../validation/operations.js';
import { ADMIN_ROLES } from '../constants/index.js';
import { statsQuerySchema } from '../validation/stats.js';
import {
  transactionsExportQuerySchema,
  transactionsQuerySchema,
} from '../validation/transactions.js';

const router = Router();

// Усе під /api/admin — лише для авторизованих.
router.use(ctrlWrapper(authenticate));

// --- Д10: керування адміністраторами й журнал дій, лише для власника ---
const ownerOnly = requireRole(ADMIN_ROLES.OWNER);

router.get('/admins', ownerOnly, ctrlWrapper(getAdminsController));

router.post(
  '/admins',
  ownerOnly,
  validateBody(createAdminSchema),
  ctrlWrapper(createAdminController),
);

router.patch(
  '/admins/:adminId',
  ownerOnly,
  validateBody(updateAdminSchema),
  ctrlWrapper(updateAdminController),
);

router.post(
  '/admins/:adminId/password',
  ownerOnly,
  validateBody(resetPasswordSchema),
  ctrlWrapper(resetAdminPasswordController),
);

// Журнал дій — лише читання. Методів на зміну чи видалення немає навмисно.
router.get(
  '/audit',
  ownerOnly,
  validateQuery(auditQuerySchema),
  ctrlWrapper(getAuditController),
);

// Д9: показники головної сторінки.
router.get(
  '/stats',
  validateQuery(statsQuerySchema),
  ctrlWrapper(getStatsController),
);

// Журнал транзакцій усіх гостей. Експорт — ДО '/transactions',
// інакше 'export' не має значення, але порядок лишаємо явним.
router.get(
  '/transactions/export',
  validateQuery(transactionsExportQuerySchema),
  ctrlWrapper(exportTransactionsController),
);

router.get(
  '/transactions',
  validateQuery(transactionsQuerySchema),
  ctrlWrapper(getTransactionsController),
);

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
