const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { resolveAccountForMovement } = require('../services/accountResolverService');
const { saveMovement, updateMovement, createDelivery } = require('../services/movementService');
const { webhookQueue } = require('../queues/webhookQueue');
const socketService = require('../services/socketService');
const { invalidateStatsCache } = require('../services/statsService');
const logger = require('../utils/logger');

async function validateProviderToken(token, providerToken) {
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

/**
 * Normalize: accept wrapped { provider_event_id, received_by_provider_at, payload }
 * or flat payload directly.
 */
function normalizePayload(body) {
  if (body.payload && typeof body.payload === 'object' && body.payload.id) {
    return {
      movementPayload: body.payload,
      providerEventId: body.provider_event_id || null,
      receivedByProviderAt: body.received_by_provider_at || null,
    };
  }
  return {
    movementPayload: body,
    providerEventId: null,
    receivedByProviderAt: null,
  };
}

async function getMovementWithRelations(movementId) {
  const [movements] = await pool.query(`
    SELECT m.*, d.name AS domain_name, a.name AS account_name
    FROM movements m
    LEFT JOIN domains d ON m.domain_id = d.id
    LEFT JOIN hgcash_accounts a ON m.hgcash_account_id = a.id
    WHERE m.id = ?
  `, [movementId]);
  return movements[0];
}

async function enqueueDelivery(movementId, domain) {
  if (!domain || !domain.id || !domain.destination_webhook_url) return;

  const [domainRows] = await pool.query(
    'SELECT * FROM domains WHERE id = ? AND is_active = 1',
    [domain.id]
  );
  const activeDomain = domainRows[0];
  if (!activeDomain) {
    logger.warn(`No active domain found for id ${domain.id}`);
    return;
  }

  const deliveryId = await createDelivery(movementId, activeDomain.id, activeDomain.destination_webhook_url);

  await webhookQueue.add(
    'forward',
    { deliveryId, movementId },
    { attempts: 5, backoff: { type: 'exponential', delay: 5000 } }
  );

  logger.info(`Delivery ${deliveryId} queued for movement ${movementId}`);
}

async function receiveWebhook(req, res, next) {
  try {
    const { token } = req.params;
    const providerTokenHeader = req.headers['x-provider-token'];
    const body = req.body;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const { movementPayload, providerEventId, receivedByProviderAt } = normalizePayload(body);

    if (!movementPayload.id) {
      return res.status(400).json({ success: false, message: 'Payload id is required' });
    }

    const { gatewayAccount, error } = await validateProviderToken(token, providerTokenHeader);
    if (error) return res.status(error.status).json(error.body);

    const gatewayEventId = uuidv4();
    const resolveResult = await resolveAccountForMovement(movementPayload);

    const { duplicate, id: movementId } = await saveMovement(
      movementPayload,
      resolveResult,
      { providerEventId, gatewayEventId, token }
    );

    // Respond only after the movement is persisted
    res.status(200).json({ success: true, message: 'Webhook received', gateway_event_id: gatewayEventId });

    if (duplicate) {
      logger.info(`Duplicate webhook ignored: hg_id=${movementPayload.id}`);
      return;
    }

    setImmediate(async () => {
      try {
        const movement = await getMovementWithRelations(movementId);
        await invalidateStatsCache();

        if (resolveResult.resolved) {
          socketService.emit('movement:new', movement);
          await enqueueDelivery(movementId, resolveResult.domain);
        } else {
          socketService.emit('movement:unresolved', movement);
          logger.warn(`Movement ${movementId} unresolved: ${resolveResult.reason}`);
        }
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
    const providerTokenHeader = req.headers['x-provider-token'];
    const body = req.body;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const { movementPayload, providerEventId } = normalizePayload(body);

    if (!movementPayload.id && !movementPayload.coelsaCode) {
      return res.status(400).json({ success: false, message: 'Payload id or coelsaCode is required' });
    }

    const { error } = await validateProviderToken(token, providerTokenHeader);
    if (error) return res.status(error.status).json(error.body);

    const resolveResult = await resolveAccountForMovement(movementPayload);
    const { id: movementId } = await updateMovement(movementPayload, resolveResult, { providerEventId, token });

    res.status(200).json({ success: true, message: 'Webhook update received' });

    setImmediate(async () => {
      try {
        const movement = await getMovementWithRelations(movementId);
        socketService.emit('movement:updated', movement);
        await invalidateStatsCache();

        if (resolveResult.resolved) {
          await enqueueDelivery(movementId, resolveResult.domain);
        }
      } catch (err) {
        logger.error('Error processing webhook update async:', err);
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { receiveWebhook, receiveWebhookUpdate };
