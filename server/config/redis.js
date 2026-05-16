const { createClient } = require('redis');
const env = require('./env');
const logger = require('../utils/logger');

const redisClient = createClient({
  socket: {
    host: env.redis.host,
    port: env.redis.port,
  },
});

redisClient.on('error', (err) => logger.error('Redis error:', err));
redisClient.on('connect', () => logger.info('Redis connected'));

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

module.exports = { redisClient, connectRedis };
