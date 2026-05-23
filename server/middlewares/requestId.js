const { v4: uuidv4 } = require('uuid');

module.exports = function requestId(req, res, next) {
  req.requestId = uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
};
