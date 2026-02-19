const handleError = (res, error, message = 'Ошибка сервера', status = 500) => {
  console.error(message, error);
  res.status(status).json({
    success: false,
    message: message
  });
};

const handleValidationError = (res, errors) => {
  res.status(400).json({
    success: false,
    errors: errors.array()
  });
};

module.exports = {
  handleError,
  handleValidationError
};