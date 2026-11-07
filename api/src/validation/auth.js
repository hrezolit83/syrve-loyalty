import Joi from 'joi';

export const loginSchema = Joi.object({
  login: Joi.string().trim().min(3).max(64).required().messages({
    'any.required': 'Вкажіть логін',
    'string.empty': 'Вкажіть логін',
    'string.min': 'Логін має містити щонайменше 3 символи',
    'string.max': 'Логін задовгий',
  }),
  password: Joi.string().min(8).max(128).required().messages({
    'any.required': 'Вкажіть пароль',
    'string.empty': 'Вкажіть пароль',
    'string.min': 'Пароль має містити щонайменше 8 символів',
    'string.max': 'Пароль задовгий',
  }),
});
