const logger = require('../utils/logger');

function errorMiddleware(err, req, res, next) {
  logger.error(`${req.method} ${req.path} - ${err.message}`, { stack: err.stack });

  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Internal server error';

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

function notFoundMiddleware(req, res) {
  res.status(404).json({ success: false, message: `Route ${req.path} not found` });
}

module.exports = { errorMiddleware, notFoundMiddleware };
