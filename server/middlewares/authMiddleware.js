const jwt = require('jsonwebtoken');
const env = require('../config/env');

function authMiddleware(req, res, next) {
  const token = req.cookies?.[env.cookie.name];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
