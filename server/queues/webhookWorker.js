require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Worker } = require('bullmq');
const { pool } = require('../config/database');
const { connectRedis } = require('../config/redis');
const { forwardWebhook } = require('../services/webhookForwardService');
const { invalidateStatsCache } = require('../services/statsService');
const { hasColumn } = require('../services/schemaService');
const socketService = require('../services/socketService');
const logService = require('../services/logService');
const logger = require('../utils/logger');
const env = require('../config/env');

const connection = { host: env.redis.host, port: env.redis.port };
const MAX_ATTEMPTS = 5;

const worker = new Worker(
  'webhook-forward',
  async (job) => {
    const { deliveryId, movementId, deliveryKind: jobDeliveryKind } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    logger.info(`Processing delivery id=${deliveryId}, attempt=${attemptNumber}`);

    await pool.query(
      "UPDATE webhook_deliveries SET status='processing', attempts=attempts+1, updated_at=NOW() WHERE id=?",
      [deliveryId]
    );

    const [deliveries] = await pool.query('SELECT * FROM webhook_deliveries WHERE id = ?', [deliveryId]);
    const delivery = deliveries[0];
    if (!delivery) throw new Error(`Delivery ${deliveryId} not found`);
    const deliveryKind = jobDeliveryKind || delivery.delivery_kind || 'initial';

    const [movements] = await pool.query('SELECT * FROM movements WHERE id = ?', [movementId]);
    const movement = movements[0];
    if (!movement) throw new Error(`Movement ${movementId} not found`);

    const [domains] = await pool.query('SELECT * FROM domains WHERE id = ?', [delivery.domain_id]);
    const domain = domains[0];
    if (!domain) throw new Error(`Domain ${delivery.domain_id} not found`);

    let httpStatus = null;
    let responseBody = null;
    let ackReceived = 0;
    let ackValid = 0;
    let ackPayload = null;
    let error = null;
    const hasDeliveryKind = await hasColumn('webhook_deliveries', 'delivery_kind');
    const hasInitialDeliveredAt = await hasColumn('webhook_deliveries', 'initial_delivered_at');
    const hasLastUpdateDeliveredAt = await hasColumn('webhook_deliveries', 'last_update_delivered_at');

    try {
      const result = await forwardWebhook(delivery, movement, domain);
      httpStatus = result.response.status;
      ackReceived = result.ackReceived;
      ackValid = result.ackValid;
      ackPayload = result.ackPayload;
      responseBody = typeof result.response.data === 'string'
        ? result.response.data.substring(0, 1000)
        : JSON.stringify(result.response.data).substring(0, 1000);

      if (result.response.status >= 200 && result.response.status < 300) {
        const successSetParts = [
          "status='success'",
          'last_http_status=?',
          'last_response_body=?',
          'ack_received=?',
          'ack_valid=?',
          'ack_payload=?',
          'delivered_at=NOW()',
          'updated_at=NOW()',
        ];
        const successParams = [
          httpStatus,
          responseBody,
          ackReceived,
          ackValid,
          ackPayload ? JSON.stringify(ackPayload) : null,
        ];
        if (hasDeliveryKind) {
          successSetParts.push('delivery_kind=?');
          successParams.push(deliveryKind);
        }
        if (deliveryKind === 'update' && hasLastUpdateDeliveredAt) {
          successSetParts.push('last_update_delivered_at=NOW()');
        }
        if (deliveryKind !== 'update' && hasInitialDeliveredAt) {
          successSetParts.push('initial_delivered_at=COALESCE(initial_delivered_at, NOW())');
        }
        successParams.push(deliveryId);
        await pool.query(
          `UPDATE webhook_deliveries SET ${successSetParts.join(', ')} WHERE id=?`,
          successParams
        );
        await pool.query(
          'UPDATE movements SET forwarded_to_domain_at=NOW(), updated_at=NOW() WHERE id=?',
          [movementId]
        );
        logger.info(`Delivery ${deliveryId} (${deliveryKind}) succeeded with HTTP ${httpStatus}`);
        logService.info({
          source: 'webhookWorker',
          event_type: deliveryKind === 'update' ? 'delivery_update_success' : 'delivery_success',
          gateway_event_id: movement.gateway_event_id,
          movement_id: movementId,
          delivery_id: deliveryId,
          message: `Delivery ${deliveryKind} succeeded HTTP ${httpStatus}`,
          metadata: { httpStatus, ackValid, delivery_kind: deliveryKind, provider_status: movement.provider_status || null },
        });
      } else {
        error = `HTTP ${result.response.status}: ${responseBody}`;
        throw new Error(error);
      }
    } catch (err) {
      // Handle ACK errors specially (ackReceived may already be 1)
      if (err.isAckError) {
        ackReceived = err.ackReceived || 0;
        ackPayload = err.ackPayload;
        ackValid = 0;
      }

      error = err.message;
      const isFinal = attemptNumber >= MAX_ATTEMPTS;
      const nextRetry = isFinal ? null : new Date(Date.now() + Math.pow(2, job.attemptsMade) * 5000);
      const newStatus = isFinal ? 'dead' : 'pending';

      await pool.query(
        `UPDATE webhook_deliveries
         SET status=?, last_http_status=?, last_response_body=?, last_error=?,
             ack_received=?, ack_valid=?, ack_payload=?,
             next_retry_at=?,
             ${isFinal ? 'dead_at=NOW(),' : ''}
             updated_at=NOW()
         WHERE id=?`,
        [
          newStatus, httpStatus, responseBody, error,
          ackReceived, ackValid, ackPayload ? JSON.stringify(ackPayload) : null,
          nextRetry,
          deliveryId,
        ]
      );

      socketService.emit('delivery:updated', { deliveryId, status: newStatus, error, provider_status: movement.provider_status || null });
      await invalidateStatsCache();

      const logEntry = {
        source: 'webhookWorker',
        event_type: isFinal
          ? (deliveryKind === 'update' ? 'delivery_update_dead' : 'delivery_dead')
          : (deliveryKind === 'update' ? 'delivery_update_retry' : 'delivery_retry'),
        gateway_event_id: movement.gateway_event_id,
        movement_id: movementId,
        delivery_id: deliveryId,
        message: isFinal
          ? `Delivery moved to DLQ after ${MAX_ATTEMPTS} attempts: ${error}`
          : `Delivery attempt ${attemptNumber} failed: ${error}`,
        metadata: {
          httpStatus,
          attempts: attemptNumber,
          isFinal,
          isAckError: err.isAckError || false,
          delivery_kind: deliveryKind,
          provider_status: movement.provider_status || null,
        },
      };
      isFinal ? logService.error(logEntry) : logService.warn(logEntry);

      if (!isFinal) throw err; // BullMQ will retry
      return; // DLQ — don't rethrow, job is considered "complete" (dead)
    }

    socketService.emit('delivery:updated', { deliveryId, status: 'success', httpStatus, ackValid, delivery_kind: deliveryKind, provider_status: movement.provider_status || null });
    await invalidateStatsCache();
  },
  { connection, attempts: MAX_ATTEMPTS, backoff: { type: 'exponential', delay: 5000 } }
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
