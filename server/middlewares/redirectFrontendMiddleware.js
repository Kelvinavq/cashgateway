const env = require('../config/env');

function redirectFrontendMiddleware(req, res, next) {
  if (env.nodeEnv !== 'production') {
    return next();
  }

  const isReadableRequest = req.method === 'GET' || req.method === 'HEAD';
  if (!isReadableRequest) {
    return next();
  }

  const path = req.path || '/';
  const isApiRoute = path.startsWith('/api/');
  const isSocketRoute = path.startsWith('/socket.io/');

  if (isApiRoute || isSocketRoute) {
    return next();
  }

  return res.status(404).json({ success: false, message: 'Not found' });
}

module.exports = redirectFrontendMiddleware;
