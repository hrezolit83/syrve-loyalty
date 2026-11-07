export const notFoundHandler = (req, res) => {
  res.status(404).json({
    status: 404,
    message: 'Маршрут не знайдено',
    data: null,
  });
};
