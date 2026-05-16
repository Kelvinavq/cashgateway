require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Worker } = require('bullmq');
const { pool } = require('../config/database');
const { connectRedis } = require('../config/redis');
const { forwardWebhook } = require('../services/webhookForwardService');
const { invalidateStatsCache } = require('../services/statsService');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');
const env = require('../config/env');

const connection = {
  host: env.redis.host,
  port: env.redis.port,
};

const worker = new Worker(
  'webhook-forward',
  async (job) => {
    const { deliveryId, movementId } = job.data;
    logger.info(`Processing delivery id=${deliveryId}, attempt=${job.attemptsMade + 1}`);

    // Mark as processing
    await pool.query(
      "UPDATE webhook_deliveries SET status='processing', attempts=attempts+1, updated_at=NOW() WHERE id=?",
      [deliveryId]
    );

    const [deliveries] = await pool.query('SELECT * FROM webhook_deliveries WHERE id = ?', [deliveryId]);
    const delivery = deliveries[0];
    if (!delivery) throw new Error(`Delivery ${deliveryId} not found`);

    const [movements] = await pool.query('SELECT * FROM movements WHERE id = ?', [movementId]);
    const movement = movements[0];
    if (!movement) throw new Error(`Movement ${movementId} not found`);

    const [domains] = await pool.query('SELECT * FROM domains WHERE id = ?', [delivery.domain_id]);
    const domain = domains[0];
    if (!domain) throw new Error(`Domain ${delivery.domain_id} not found`);

    let httpStatus = null;
    let responseBody = null;
    let error = null;

    try {
      const response = await forwardWebhook(delivery, movement, domain);
      httpStatus = response.status;
      responseBody = typeof response.data === 'string' ? response.data.substring(0, 1000) : JSON.stringify(response.data).substring(0, 1000);

      if (response.status >= 200 && response.status < 300) {
        await pool.query(
          "UPDATE webhook_deliveries SET status='success', last_http_status=?, last_response_body=?, delivered_at=NOW(), updated_at=NOW() WHERE id=?",
          [httpStatus, responseBody, deliveryId]
        );
        await pool.query("UPDATE movements SET forwarded_to_domain_at=NOW(), updated_at=NOW() WHERE id=?", [movementId]);
        logger.info(`Delivery ${deliveryId} succeeded with HTTP ${httpStatus}`);
      } else {
        error = `HTTP ${response.status}: ${responseBody}`;
        throw new Error(error);
      }
    } catch (err) {
      error = err.message;
      const maxAttempts = 5;
      const isFinal = (job.attemptsMade + 1) >= maxAttempts;
      const nextRetry = isFinal ? null : new Date(Date.now() + Math.pow(2, job.attemptsMade) * 5000);

      await pool.query(
        "UPDATE webhook_deliveries SET status=?, last_http_status=?, last_response_body=?, last_error=?, next_retry_at=?, updated_at=NOW() WHERE id=?",
        [isFinal ? 'failed' : 'pending', httpStatus, responseBody, error, nextRetry, deliveryId]
      );

      socketService.emit('delivery:updated', { deliveryId, status: isFinal ? 'failed' : 'pending', error });
      await invalidateStatsCache();

      if (!isFinal) {
        throw err; // BullMQ will retry
      }
      return; // Final failure — don't rethrow
    }

    socketService.emit('delivery:updated', { deliveryId, status: 'success', httpStatus });
    await invalidateStatsCache();
  },
  {
    connection,
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
  }
);

worker.on('completed', (job) => logger.info(`Job ${job.id} completed`));
worker.on('failed', (job, err) => logger.error(`Job ${job?.id} failed: ${err.message}`));

async function start() {
  await connectRedis();
  logger.info('Webhook worker started');
}

start().catch((err) => {
  logger.error('Worker start error:', err);
  process.exit(1);
});

module.exports = worker;
