const { RateLimiterRedis } = require('rate-limiter-flexible');
const { redisClient } = require('../config/redis');
const { pool } = require('../config/database');
const { extractIp } = require('../utils/ipValidator');
const logService = require('../services/logService');
const logger = require('../utils/logger');

let limiterByIP;
let limiterByProvider;

function getLimiters() {
  if (!limiterByIP) {
    limiterByIP = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl_ip',
      points: 300,
      duration: 60,
    });
  }
  if (!limiterByProvider) {
    limiterByProvider = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl_prov',
      points: 100,
      duration: 60,
    });
  }
  return { limiterByIP, limiterByProvider };
}

module.exports = async function providerRateLimit(req, res, next) {
  const ip = extractIp(req);
  const token = req.params.token;
  const { limiterByIP: ipLimiter, limiterByProvider: providerLimiter } = getLimiters();

  // IP-based rate limit (always applies)
  try {
    await ipLimiter.consume(ip);
  } catch (rateLimitRes) {
    if (rateLimitRes instanceof Error) {
      logger.error('Rate limiter Redis error (IP):', rateLimitRes);
      return next(); // Fail open on Redis errors
    }
    const retryAfter = Math.ceil(rateLimitRes.msBeforeNext / 1000);
    res.setHeader('Retry-After', retryAfter);
    logService.warn({
      source: 'providerRateLimit',
      event_type: 'rate_limit_ip',
      request_id: req.requestId,
      message: `Rate limit exceeded for IP ${ip}`,
      ip_address: ip,
      metadata: { retryAfter },
    });
    return res.status(429).json({ success: false, message: 'Rate limit exceeded', retry_after: retryAfter });
  }

  // Provider-based rate limit (only when token matches a provider_source)
  if (token) {
    try {
      const [rows] = await pool.query(
        'SELECT id FROM provider_sources WHERE token = ? AND is_active = 1 LIMIT 1',
        [token]
      );
      if (rows[0]) {
        try {
          await providerLimiter.consume(`provider_${rows[0].id}`);
        } catch (rateLimitRes) {
          if (rateLimitRes instanceof Error) {
            logger.error('Rate limiter Redis error (provider):', rateLimitRes);
            return next();
          }
          const retryAfter = Math.ceil(rateLimitRes.msBeforeNext / 1000);
          res.setHeader('Retry-After', retryAfter);
          logService.warn({
            source: 'providerRateLimit',
            event_type: 'rate_limit_provider',
            request_id: req.requestId,
            provider_source_id: rows[0].id,
            message: `Rate limit exceeded for provider ${rows[0].id}`,
            ip_address: ip,
            metadata: { provider_id: rows[0].id, retryAfter },
          });
          return res.status(429).json({ success: false, message: 'Rate limit exceeded', retry_after: retryAfter });
        }
      }
    } catch (dbErr) {
      logger.error('providerRateLimit DB error:', dbErr);
      // Fail open on DB errors
    }
  }

  next();
};
