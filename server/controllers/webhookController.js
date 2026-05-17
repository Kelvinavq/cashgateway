const { pool } = require('../config/database');
const { resolveAccount } = require('../services/accountResolverService');
const { saveMovement, updateMovement, createDelivery } = require('../services/movementService');
const { webhookQueue } = require('../queues/webhookQueue');
const socketService = require('../services/socketService');
const { invalidateStatsCache } = require('../services/statsService');
const logger = require('../utils/logger');

async function validateGatewayAccount(token, providerToken) {
  const [accounts] = await pool.query(
    'SELECT * FROM hgcash_accounts WHERE gateway_token = ? AND is_active = 1 LIMIT 1',
    [token]
  );

  if (!accounts[0]) {
    logger.warn(`Unknown gateway token: ${token}`);
    return { error: { status: 200, body: { success: false, message: 'Unknown token' } } };
  }

  const gatewayAccount = accounts[0];

  if (gatewayAccount.provider_token && providerToken !== gatewayAccount.provider_token) {
    logger.warn(`Invalid provider token for account ${gatewayAccount.id}`);
    return { error: { status: 401, body: { success: false, message: 'Invalid provider token' } } };
  }

  return { gatewayAccount };
}

async function resolvePayloadAccount(payload, gatewayAccount) {
  const account = await resolveAccount({
    accountId: payload.accountId,
    toCUIT: payload.toCUIT,
    toCBU: payload.toCBU,
    coelsaCode: payload.coelsaCode,
  });

  return account || gatewayAccount;
}

async function getMovementWithRelations(movementId) {
  const [movements] = await pool.query(`
    SELECT m.*, d.name as domain_name, a.name as account_name
    FROM movements m
    LEFT JOIN domains d ON m.domain_id = d.id
    LEFT JOIN hgcash_accounts a ON m.hgcash_account_id = a.id
    WHERE m.id = ?
  `, [movementId]);

  return movements[0];
}

async function enqueueDelivery(movementId, resolvedAccount) {
  if (!resolvedAccount || !resolvedAccount.domain_id) return;

  const [domains] = await pool.query(
    'SELECT * FROM domains WHERE id = ? AND is_active = 1',
    [resolvedAccount.domain_id]
  );
  const domain = domains[0];

  if (!domain || !domain.destination_webhook_url) {
    logger.warn(`No active domain or destination URL for account ${resolvedAccount.id}`);
    return;
  }

  const deliveryId = await createDelivery(movementId, domain.id, domain.destination_webhook_url);

  await webhookQueue.add(
    'forward',
    { deliveryId, movementId },
    {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );

  logger.info(`Delivery ${deliveryId} queued for movement ${movementId}`);
}

async function receiveWebhook(req, res, next) {
  try {
    const { token } = req.params;
    const providerToken = req.headers['x-provider-token'];
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    if (!payload.id) {
      return res.status(400).json({ success: false, message: 'Payload id is required' });
    }

    const { gatewayAccount, error } = await validateGatewayAccount(token, providerToken);
    if (error) return res.status(error.status).json(error.body);

    // Respond immediately
    res.status(200).json({ success: true, message: 'Webhook received' });

    // Process async
    setImmediate(async () => {
      try {
        const resolvedAccount = await resolvePayloadAccount(payload, gatewayAccount);

        // Save movement (handles duplicates)
        const { duplicate, id: movementId } = await saveMovement(payload, resolvedAccount, token);

        if (duplicate) {
          logger.info(`Duplicate webhook ignored: hg_id=${payload.id}`);
          return;
        }

        const movement = await getMovementWithRelations(movementId);

        // Emit new movement event
        socketService.emit('movement:new', movement);
        await invalidateStatsCache();

        // Create delivery and enqueue
        await enqueueDelivery(movementId, resolvedAccount);
      } catch (err) {
        logger.error('Error processing webhook async:', err);
      }
    });
  } catch (err) {
    next(err);
  }
}

async function receiveWebhookUpdate(req, res, next) {
  try {
    const { token } = req.params;
    const providerToken = req.headers['x-provider-token'];
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    if (!payload.id && !payload.coelsaCode) {
      return res.status(400).json({ success: false, message: 'Payload id or coelsaCode is required' });
    }

    const { gatewayAccount, error } = await validateGatewayAccount(token, providerToken);
    if (error) return res.status(error.status).json(error.body);

    res.status(200).json({ success: true, message: 'Webhook update received' });

    setImmediate(async () => {
      try {
        const resolvedAccount = await resolvePayloadAccount(payload, gatewayAccount);
        const { id: movementId } = await updateMovement(payload, resolvedAccount, token);
        const movement = await getMovementWithRelations(movementId);

        socketService.emit('movement:updated', movement);
        await invalidateStatsCache();
        await enqueueDelivery(movementId, resolvedAccount);
      } catch (err) {
        logger.error('Error processing webhook update async:', err);
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { receiveWebhook, receiveWebhookUpdate };
