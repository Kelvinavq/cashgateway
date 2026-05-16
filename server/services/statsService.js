const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

async function invalidateStatsCache() {
  try {
    await redisClient.del('dashboard:stats');
  } catch (e) {
    logger.warn('Failed to invalidate stats cache:', e.message);
  }
}

module.exports = { invalidateStatsCache };
