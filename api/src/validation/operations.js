import Joi from 'joi';

/**
 * Сума: більша за нуль, не більше 2 знаків після коми.
 * precision(2) з Joi округлює, а не відхиляє, тому межу перевіряємо самі —
 * адміністратор має бачити, що саме не так.
 */
const amount = Joi.number()
  .greater(0)
  .max(1000000)
  .custom((value, helpers) => {
    const decimals = String(value).split('.')[1]?.length ?? 0;
    return decimals > 2 ? helpers.error('number.precision2') : value;
  })
  .required()
  .messages({
    'any.required': 'Вкажіть суму',
    'number.base': 'Сума має бути числом',
    'number.greater': 'Сума має бути більшою за нуль',
    'number.max': 'Сума завелика',
    'number.precision2': 'Не більше двох знаків після коми',
  });

export const operationSchema = Joi.object({
  amount,
  reason: Joi.string().trim().min(3).max(200).required().messages({
    'any.required': 'Вкажіть причину',
    'string.empty': 'Вкажіть причину',
    'string.min': 'Причина має містити щонайменше 3 символи',
    'string.max': 'Причина задовга (максимум 200 символів)',
  }),
});
