import Joi from 'joi';

import { ADMIN_ROLES } from '../constants/index.js';

const login = Joi.string().trim().min(3).max(64).messages({
  'string.empty': 'Вкажіть логін',
  'string.min': 'Логін має містити щонайменше 3 символи',
  'string.max': 'Логін задовгий',
});

const password = Joi.string().min(8).max(128).messages({
  'string.empty': 'Вкажіть пароль',
  'string.min': 'Пароль має містити щонайменше 8 символів',
  'string.max': 'Пароль задовгий',
});

const role = Joi.string()
  .valid(ADMIN_ROLES.OWNER, ADMIN_ROLES.MANAGER)
  .messages({ 'any.only': 'Роль має бути owner або manager' });

export const createAdminSchema = Joi.object({
  login: login.required().messages({ 'any.required': 'Вкажіть логін' }),
  password: password.required().messages({ 'any.required': 'Вкажіть пароль' }),
  role: role.default(ADMIN_ROLES.MANAGER),
});

/** Хоча б одне поле: порожній PATCH — це помилка виклику, а не «нічого». */
export const updateAdminSchema = Joi.object({
  role,
  isActive: Joi.boolean(),
})
  .min(1)
  .messages({ 'object.min': 'Немає що змінювати' });

export const resetPasswordSchema = Joi.object({
  password: password.required().messages({ 'any.required': 'Вкажіть пароль' }),
});
