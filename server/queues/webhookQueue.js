const { Queue } = require('bullmq');
const env = require('../config/env');

const connection = {
  host: env.redis.host,
  port: env.redis.port,
};

const webhookQueue = new Queue('webhook-forward', { connection });

module.exports = { webhookQueue };
