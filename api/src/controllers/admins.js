import { AUDIT_ACTIONS } from '../constants/index.js';
import {
  createAdmin,
  getAdmins,
  resetAdminPassword,
  updateAdmin,
} from '../services/admins.js';
import { requestIp, writeAuditLog } from '../services/audit.js';

export const getAdminsController = async (req, res) => {
  res.json({ status: 200, message: 'ok', data: { admins: await getAdmins() } });
};

export const createAdminController = async (req, res) => {
  const admin = await createAdmin(req.body);

  await writeAuditLog({
    admin: req.admin,
    action: AUDIT_ACTIONS.ADMIN_CREATE,
    targetType: 'admin',
    targetId: admin.id,
    // Пароля в журналі немає й бути не може — лише факт створення.
    details: { login: admin.login, role: admin.role },
    ip: requestIp(req),
  });

  res.status(201).json({
    status: 201,
    message: 'Адміністратора створено',
    data: { admin },
  });
};

export const updateAdminController = async (req, res) => {
  const admin = await updateAdmin({
    id: req.params.adminId,
    actorId: req.admin.id,
    ...req.body,
  });

  // Деактивація — окрема дія в журналі: саме її шукають, коли розбираються,
  // чому людина раптом не може увійти.
  const isDeactivation = req.body.isActive === false;

  await writeAuditLog({
    admin: req.admin,
    action: isDeactivation
      ? AUDIT_ACTIONS.ADMIN_DEACTIVATE
      : AUDIT_ACTIONS.ADMIN_UPDATE,
    targetType: 'admin',
    targetId: admin.id,
    details: { login: admin.login, ...req.body },
    ip: requestIp(req),
  });

  res.json({
    status: 200,
    message: isDeactivation ? 'Доступ вимкнено' : 'Адміністратора змінено',
    data: { admin },
  });
};

export const resetAdminPasswordController = async (req, res) => {
  const admin = await resetAdminPassword({
    id: req.params.adminId,
    password: req.body.password,
  });

  await writeAuditLog({
    admin: req.admin,
    action: AUDIT_ACTIONS.ADMIN_PASSWORD_RESET,
    targetType: 'admin',
    targetId: admin.id,
    details: { login: admin.login },
    ip: requestIp(req),
  });

  res.json({ status: 200, message: 'Пароль змінено', data: { admin } });
};
