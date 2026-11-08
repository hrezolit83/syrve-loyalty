import { getStats } from '../services/stats.js';

/** Д9: показники головної сторінки панелі. */
export const getStatsController = async (req, res) => {
  const data = await getStats(req.validatedQuery);

  res.json({ status: 200, message: 'ok', data });
};
