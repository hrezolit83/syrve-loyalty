import { getAuditLog } from '../services/audit.js';

/**
 * Журнал дій — лише читання.
 *
 * Методів на зміну й видалення запису тут немає навмисно: журнал, з якого
 * можна прибрати рядок, не виконує своєї роботи.
 */
export const getAuditController = async (req, res) => {
  const data = await getAuditLog(req.validatedQuery);

  res.json({ status: 200, message: 'ok', data });
};
