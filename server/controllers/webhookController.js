const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { resolveAccountForMovement } = require('../services/accountResolverService');
const { saveMovement, updateMovement, createDelivery } = require('../services/movementService');
const { webhookQueue } = require('../queues/webhookQueue');
const socketService = require('../services/socketService');
const { invalidateStatsCache } = require('../services/statsService');
const logService = require('../services/logService');
const { extractIp, isIpAllowed } = require('../utils/ipValidator');
const logger = require('../utils/logger');

/**
 * Resolve auth from provider_sources (new) with fallback to hgcash_accounts.gateway_token (legacy).
 * Returns { providerSource, gatewayAccount, error }
 */
async function resolveAuth(token, providerTokenHeader, ip) {
  // 1. Try provider_sources (new system)
  const [providers] = await pool.query(
    'SELECT * FROM provider_sources WHERE token = ? AND is_active = 1 LIMIT 1',
    [token]
  );
  if (providers[0]) {
    const src = providers[0];
    const whitelist = src.ip_whitelist ? JSON.parse(src.ip_whitelist) : null;
    if (!isIpAllowed(ip, whitelist)) {
      logger.warn(`IP ${ip} not in whitelist for provider ${src.id}`);
      return { error: { status: 401, body: { success: false, message: 'IP not allowed' } } };
    }
    return { providerSource: src, gatewayAccount: null };
  }

  // 2. Fallback: legacy per-account gateway_token
  const [accounts] = await pool.query(
    'SELECT * FROM hgcash_accounts WHERE gateway_token = ? AND is_active = 1 LIMIT 1',
    [token]
  );
  if (!accounts[0]) {
    logger.warn(`Unknown token: ${token}`);
    return { error: { status: 200, body: { success: false, message: 'Unknown token' } } };
  }
  const gatewayAccount = accounts[0];
  if (gatewayAccount.provider_token && providerTokenHeader !== gatewayAccount.provider_token) {
    logger.warn(`Invalid provider token for legacy account ${gatewayAccount.id}`);
    return { error: { status: 401, body: { success: false, message: 'Invalid provider token' } } };
  }
  return { providerSource: null, gatewayAccount };
}

function normalizePayload(body) {
  if (body.payload && typeof body.payload === 'object' && body.payload.id) {
    return {
      movementPayload: body.payload,
      providerEventId: body.provider_event_id || null,
      receivedByProviderAt: body.received_by_provider_at || null,
    };
  }
  return { movementPayload: body, providerEventId: null, receivedByProviderAt: null };
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
  if (!domain?.id || !domain?.destination_webhook_url) return;

  const [domainRows] = await pool.query(
    'SELECT * FROM domains WHERE id = ? AND is_active = 1',
    [domain.id]
  );
  if (!domainRows[0]) return;

  const deliveryId = await createDelivery(movementId, domainRows[0].id, domainRows[0].destination_webhook_url);
  await webhookQueue.add('forward', { deliveryId, movementId }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
  });
  logger.info(`Delivery ${deliveryId} queued for movement ${movementId}`);
}

async function receiveWebhook(req, res, next) {
  const ip = extractIp(req);

  try {
    const { token } = req.params;
    const providerTokenHeader = req.headers['x-provider-token'];
    const body = req.body;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const { movementPayload, providerEventId } = normalizePayload(body);

    if (!movementPayload.id) {
      return res.status(400).json({ success: false, message: 'Payload id is required' });
    }

    const { providerSource, gatewayAccount, error } = await resolveAuth(token, providerTokenHeader, ip);

    if (error) {
      logService.warn({
        source: 'webhookController',
        event_type: 'auth_failure',
        request_id: req.requestId,
        message: error.body.message,
        ip_address: ip,
        metadata: { token: token.substring(0, 8) },
      });
      return res.status(error.status).json(error.body);
    }

    const gatewayEventId = uuidv4();
    const resolveResult = await resolveAccountForMovement(movementPayload);

    const { duplicate, id: movementId, gatewayEventId: dupGatewayEventId } = await saveMovement(
      movementPayload,
      resolveResult,
      {
        providerEventId,
        gatewayEventId,
        token,
        providerSourceId: providerSource?.id || null,
      }
    );

    if (duplicate) {
      logService.info({
        source: 'webhookController',
        event_type: 'duplicate_webhook',
        request_id: req.requestId,
        gateway_event_id: dupGatewayEventId,
        provider_source_id: providerSource?.id,
        movement_id: movementId,
        message: `Duplicate webhook ignored: hg_id=${movementPayload.id}`,
        ip_address: ip,
        metadata: { hg_id: movementPayload.id, provider_event_id: providerEventId },
      });
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'Webhook already processed',
        gateway_event_id: dupGatewayEventId,
      });
    }

    res.status(200).json({ success: true, duplicate: false, message: 'Webhook received', gateway_event_id: gatewayEventId });

    setImmediate(async () => {
      try {
        const movement = await getMovementWithRelations(movementId);
        await invalidateStatsCache();

        if (resolveResult.resolved) {
          socketService.emit('movement:new', movement);
          await enqueueDelivery(movementId, resolveResult.domain);
          logService.info({
            source: 'webhookController',
            event_type: 'movement_received',
            request_id: req.requestId,
            gateway_event_id: gatewayEventId,
            provider_source_id: providerSource?.id,
            movement_id: movementId,
            message: `Movement received and resolved via ${resolveResult.method}`,
            ip_address: ip,
          });
        } else {
          socketService.emit('movement:unresolved', movement);
          logService.warn({
            source: 'webhookController',
            event_type: 'movement_unresolved',
            request_id: req.requestId,
            gateway_event_id: gatewayEventId,
            provider_source_id: providerSource?.id,
            movement_id: movementId,
            message: resolveResult.reason,
            ip_address: ip,
            metadata: { accountId: movementPayload.accountId },
          });
        }
      } catch (err) {
        logger.error('Error processing webhook async:', err);
        logService.error({
          source: 'webhookController',
          event_type: 'webhook_processing_error',
          request_id: req.requestId,
          gateway_event_id: gatewayEventId,
          message: err.message,
          ip_address: ip,
        });
      }
    });
  } catch (err) {
    next(err);
  }
}

async function receiveWebhookUpdate(req, res, next) {
  const ip = extractIp(req);

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

    const { providerSource, error } = await resolveAuth(token, providerTokenHeader, ip);
    if (error) return res.status(error.status).json(error.body);

    const resolveResult = await resolveAccountForMovement(movementPayload);
    const { id: movementId } = await updateMovement(movementPayload, resolveResult, {
      providerEventId,
      token,
      providerSourceId: providerSource?.id || null,
    });

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
