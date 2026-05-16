const express = require('express');

// Store raw body for webhook signature verification
function rawBodyMiddleware(req, res, next) {
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })(req, res, next);
}

module.exports = rawBodyMiddleware;
