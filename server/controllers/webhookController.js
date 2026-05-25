const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { resolveDestinationsForWebhook, collectDestinationHints } = require('../services/domainResolverService');
const { saveMovement, updateMovement, syncDeliveriesForMovement } = require('../services/movementService');
const { webhookQueue } = require('../queues/webhookQueue');
const socketService = require('../services/socketService');
const { invalidateStatsCache } = require('../services/statsService');
const logService = require('../services/logService');
const { hasColumn } = require('../services/schemaService');
const { extractIp, isIpAllowed } = require('../utils/ipValidator');
const { normalizeDomain } = require('../utils/domainNormalizer');
const logger = require('../utils/logger');

function parseMaybeJson(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const PROVIDER_STATUSES = new Set(['pending', 'paid', 'rejected']);

function normalizeProviderStatus(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  return PROVIDER_STATUSES.has(normalized) ? normalized : null;
}

function extractProviderStatus(wrapper = {}, movementPayload = {}) {
  return normalizeProviderStatus(
    wrapper?.provider_status ??
    movementPayload?.provider_status ??
    null
  );
}

function stripProviderStatusFromObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const { provider_status, ...rest } = value;
  return rest;
}

function normalizeWebhookBody(body) {
  if (body?.payload && typeof body.payload === 'object' && body.payload.id) {
    return { wrapper: body, movementPayload: body.payload };
  }
  return { wrapper: body, movementPayload: body };
}

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

async function getMovementWithRelations(movementId) {
  const hasDomainHostname = await hasColumn('domains', 'hostname');
  const hasProviderStatus = await hasColumn('movements', 'provider_status');
  const [movements] = await pool.query(`
    SELECT m.*,
      d.name AS domain_name,
      ${hasDomainHostname ? 'd.hostname AS domain_hostname' : 'NULL AS domain_hostname'},
      ${hasProviderStatus ? 'm.provider_status AS provider_status' : 'NULL AS provider_status'},
      a.name AS account_name,
      (SELECT COUNT(*) FROM webhook_deliveries wd WHERE wd.movement_id = m.id) AS delivery_count,
      (SELECT GROUP_CONCAT(DISTINCT ${hasDomainHostname ? 'dom.hostname' : 'dom.base_url'} ORDER BY ${hasDomainHostname ? 'dom.hostname' : 'dom.base_url'} SEPARATOR ', ')
         FROM webhook_deliveries wd
         LEFT JOIN domains dom ON wd.domain_id = dom.id
        WHERE wd.movement_id = m.id) AS delivery_domains
    FROM movements m
    LEFT JOIN domains d ON m.domain_id = d.id
    LEFT JOIN hgcash_accounts a ON m.hgcash_account_id = a.id
    WHERE m.id = ?
  `, [movementId]);
  return movements[0];
}

async function getExistingMovementByKeys(movementPayload, providerEventId) {
  const [rows] = await pool.query(
    `SELECT * FROM movements
      WHERE hg_id = ?
         OR (coelsa_code = ? AND coelsa_code IS NOT NULL)
         OR (provider_event_id = ? AND provider_event_id IS NOT NULL)
      LIMIT 1`,
    [movementPayload.id || null, movementPayload.coelsaCode || null, providerEventId || null]
  );
  return rows[0] || null;
}

async function getExistingDomainsForMovement(movementId, fallbackDomainId = null) {
  const hasDomainHostname = await hasColumn('domains', 'hostname');
  const [rows] = await pool.query(
    `SELECT DISTINCT d.*
       FROM webhook_deliveries wd
       INNER JOIN domains d ON wd.domain_id = d.id
      WHERE wd.movement_id = ?
      ORDER BY ${hasDomainHostname ? 'd.hostname ASC' : 'd.base_url ASC'}, d.id ASC`,
    [movementId]
  );

  if (rows.length) return rows;

  if (!fallbackDomainId) return [];

  const [fallbackRows] = await pool.query(
    'SELECT * FROM domains WHERE id = ? AND is_active = 1 LIMIT 1',
    [fallbackDomainId]
  );
  return fallbackRows[0] ? [fallbackRows[0]] : [];
}

function buildStoredResolutionResult(existingMovement, domains) {
  const destinationDomainsRaw = parseMaybeJson(existingMovement?.destination_domains_raw);
  const resolutionStatus = existingMovement?.resolution_status
    || (domains.length > 1 ? 'multi_resolved' : (domains.length === 1 ? 'resolved' : 'unresolved'));

  return {
    resolved: domains.length > 0 || existingMovement?.resolution_status === 'resolved' || existingMovement?.resolution_status === 'multi_resolved',
    method: existingMovement?.resolution_method || 'none',
    domains,
    account: null,
    resolutionStatus,
    unresolvedReason: existingMovement?.unresolved_reason || null,
    destinationDomainRaw: existingMovement?.destination_domain_raw || null,
    destinationDomainsRaw,
    providerStatus: existingMovement?.provider_status || null,
    diagnostics: {
      rawDestinationDomains: [],
      normalizedDestinationDomains: [],
      invalidDestinationDomains: [],
      missingDestinationDomains: [],
      foundHostnames: domains.map(domain => domain.hostname || normalizeDomain(domain.base_url)).filter(Boolean),
      partialMatch: false,
    },
    hasExplicitDestinationHints: false,
  };
}

async function requeueExistingDeliveriesForUpdate({ movementId, domainIds, providerStatus }) {
  const uniqueDomainIds = [...new Set((domainIds || []).map(Number).filter(Boolean))];
  if (!uniqueDomainIds.length) return [];

  const placeholders = uniqueDomainIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT id, domain_id
       FROM webhook_deliveries
      WHERE movement_id = ? AND domain_id IN (${placeholders})`,
    [movementId, ...uniqueDomainIds]
  );

  if (!rows.length) return [];

  const hasProviderStatus = await hasColumn('webhook_deliveries', 'provider_status');
  const hasDeliveryKind = await hasColumn('webhook_deliveries', 'delivery_kind');

  for (const row of rows) {
    const setParts = [
      "status = 'pending'",
      'next_retry_at = NULL',
      'last_error = NULL',
      'updated_at = NOW()',
    ];
    const params = [];
    if (hasProviderStatus) {
      setParts.push('provider_status = ?');
      params.push(normalizeProviderStatus(providerStatus));
    }
    if (hasDeliveryKind) {
      setParts.push("delivery_kind = 'update'");
    }

    await pool.query(
      `UPDATE webhook_deliveries SET ${setParts.join(', ')} WHERE id = ?`,
      [...params, row.id]
    );

    await webhookQueue.add('forward', { deliveryId: row.id, movementId, deliveryKind: 'update' }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  return rows.map(row => row.id);
}

async function queueDeliveriesForMovement({ movementId, movement, resolveResult, providerSourceId, requestId, ip, requeueExisting = false, deliveryKind = 'initial' }) {
  const createdDeliveries = [];
  const skippedDomains = [];

  if (resolveResult?.domains?.length) {
    const { created, skipped } = await syncDeliveriesForMovement(movementId, resolveResult.domains, movement.provider_status, deliveryKind);

    for (const item of created) {
      createdDeliveries.push(item.deliveryId);
      await webhookQueue.add('forward', { deliveryId: item.deliveryId, movementId, deliveryKind }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
      });
    }

    if (skipped.length) {
      skippedDomains.push(...skipped);
      const requeuedDeliveryIds = requeueExisting
        ? await requeueExistingDeliveriesForUpdate({
          movementId,
          domainIds: skipped,
          providerStatus: movement.provider_status || resolveResult?.providerStatus || null,
        })
        : [];

      logService.info({
        source: 'webhookController',
        event_type: requeueExisting ? 'delivery_update_requeued' : 'delivery_duplicate_skipped',
        request_id: requestId,
        gateway_event_id: movement.gateway_event_id,
        provider_source_id: providerSourceId || null,
        movement_id: movementId,
        message: requeueExisting
          ? `Existing deliveries requeued for movement update ${movementId}`
          : `Duplicate delivery skipped for movement ${movementId}`,
        ip_address: ip,
        metadata: {
          domains: resolveResult.domains.map(d => ({
            id: d.id,
            hostname: d.hostname || normalizeDomain(d.base_url),
            name: d.name,
          })),
          skipped_domain_ids: skipped,
          requeued_delivery_ids: requeuedDeliveryIds,
          provider_status: movement.provider_status || resolveResult?.providerStatus || null,
        },
      });
    }
  }

  return { createdDeliveries, skippedDomains };
}

function buildSocketMovementPayload(movement, resolveResult) {
  const resolutionStatus = movement?.resolution_status || resolveResult?.resolutionStatus || 'unresolved';
  const domainsCount = Array.isArray(resolveResult?.domains) ? resolveResult.domains.length : 0;

  return {
    ...movement,
    resolution_status: resolutionStatus,
    domains_count: domainsCount,
    metadata: {
      resolution_status: resolutionStatus,
      domains_count: domainsCount,
    },
  };
}

function logDestinationResolution({ movement, resolveResult, providerSourceId, requestId, ip }) {
  const metadata = {
    raw_destination_domains: resolveResult?.diagnostics?.rawDestinationDomains || [],
    normalized_destination_domains: resolveResult?.diagnostics?.normalizedDestinationDomains || [],
    invalid_destination_domains: resolveResult?.diagnostics?.invalidDestinationDomains || [],
    domains_found: resolveResult?.domains?.map(d => ({
      id: d.id,
      hostname: d.hostname || normalizeDomain(d.base_url),
      name: d.name,
    })) || [],
    domains_missing: resolveResult?.diagnostics?.missingDestinationDomains || [],
    provider_status: movement.provider_status || resolveResult?.providerStatus || null,
    movement_id: movement.id,
    provider_event_id: movement.provider_event_id,
    gateway_event_id: movement.gateway_event_id,
  };

  if (resolveResult?.hasExplicitDestinationHints) {
    if (resolveResult.diagnostics?.invalidDestinationDomains?.length) {
      logService.warn({
        source: 'webhookController',
        event_type: 'invalid_destination_domain',
        request_id: requestId,
        gateway_event_id: movement.gateway_event_id,
        provider_source_id: providerSourceId || null,
        movement_id: movement.id,
        message: 'Invalid destination domain received',
        ip_address: ip,
        metadata,
      });
    }

    if (!resolveResult.resolved) {
      logService.warn({
        source: 'webhookController',
        event_type: 'destination_domain_not_found',
        request_id: requestId,
        gateway_event_id: movement.gateway_event_id,
        provider_source_id: providerSourceId || null,
        movement_id: movement.id,
        message: resolveResult.unresolvedReason || 'Destination domain not found',
        ip_address: ip,
        metadata,
      });
      return;
    }

    if (resolveResult.diagnostics?.partialMatch) {
      logService.warn({
        source: 'webhookController',
        event_type: 'destination_domains_partial_match',
        request_id: requestId,
        gateway_event_id: movement.gateway_event_id,
        provider_source_id: providerSourceId || null,
        movement_id: movement.id,
        message: 'Partial destination domains match',
        ip_address: ip,
        metadata,
      });
    }

    if (resolveResult.resolutionStatus === 'multi_resolved') {
      logService.info({
        source: 'webhookController',
        event_type: 'multi_destination_resolved',
        request_id: requestId,
        gateway_event_id: movement.gateway_event_id,
        provider_source_id: providerSourceId || null,
        movement_id: movement.id,
        message: `Movement resolved to ${resolveResult.domains.length} destinations`,
        ip_address: ip,
        metadata,
      });
    }
  }
}

async function processPersistedMovement({ movementId, providerSourceId, requestId, ip, resolved, movementPayload, resolveResult, socketEvent, requeueExistingDeliveries = false, deliveryKind = 'initial' }) {
  let movement = await getMovementWithRelations(movementId);
  await invalidateStatsCache();

  if (resolved) {
    await queueDeliveriesForMovement({
      movementId,
      movement,
      resolveResult,
      providerSourceId,
      requestId,
      ip,
      requeueExisting: requeueExistingDeliveries,
      deliveryKind,
    });
    movement = await getMovementWithRelations(movementId);
    socketService.emit(socketEvent, buildSocketMovementPayload(movement, resolveResult));
    logDestinationResolution({ movement, resolveResult, providerSourceId, requestId, ip });
  } else {
    socketService.emit('movement:unresolved', movement);
    logService.warn({
      source: 'webhookController',
      event_type: 'movement_unresolved',
      request_id: requestId,
      gateway_event_id: movement.gateway_event_id,
      provider_source_id: providerSourceId || null,
      movement_id: movementId,
      message: resolveResult.unresolvedReason || 'Movement unresolved',
      ip_address: ip,
      metadata: {
        accountId: movementPayload.accountId,
        destination_domain_raw: resolveResult.destinationDomainRaw || null,
        destination_domains_raw: resolveResult.destinationDomainsRaw || null,
        provider_status: movement.provider_status || resolveResult?.providerStatus || null,
      },
    });
  }

  return movement;
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

    const { wrapper, movementPayload } = normalizeWebhookBody(body);
    const providerEventId = wrapper.provider_event_id || movementPayload.provider_event_id || null;
    const receivedByProviderAt = wrapper.received_by_provider_at || movementPayload.received_by_provider_at || null;
    const providerStatus = extractProviderStatus(wrapper, movementPayload);

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
        metadata: { token: token.substring(0, 8), provider_status: providerStatus },
      });
      return res.status(error.status).json(error.body);
    }

    const gatewayEventId = uuidv4();
    const resolveResult = await resolveDestinationsForWebhook({ wrapper, movementPayload, allowAccountFallback: true });

    const { duplicate, id: movementId, gatewayEventId: dupGatewayEventId } = await saveMovement(
      movementPayload,
      resolveResult,
      {
        providerEventId,
        gatewayEventId,
        token,
        providerSourceId: providerSource?.id || null,
        receivedByProviderAt,
        rawPayload: body,
        destinationDomainRaw: resolveResult.destinationDomainRaw,
        destinationDomainsRaw: resolveResult.destinationDomainsRaw,
        providerStatus,
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
        metadata: { hg_id: movementPayload.id, provider_event_id: providerEventId, provider_status: providerStatus },
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
        await processPersistedMovement({
          movementId,
          providerSourceId: providerSource?.id,
          requestId: req.requestId,
          ip,
          resolved: resolveResult.resolved,
          movementPayload,
          resolveResult,
          socketEvent: 'movement:new',
        });
        if (gatewayAccount) {
          logger.info(`Legacy gateway account used for webhook ${gatewayAccount.id}`);
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

    const { wrapper, movementPayload } = normalizeWebhookBody(body);
    const providerEventId = wrapper.provider_event_id || movementPayload.provider_event_id || null;
    const receivedByProviderAt = wrapper.received_by_provider_at || movementPayload.received_by_provider_at || null;
    const providerStatus = extractProviderStatus(wrapper, movementPayload);

    if (!movementPayload.id && !movementPayload.coelsaCode) {
      return res.status(400).json({ success: false, message: 'Payload id or coelsaCode is required' });
    }

    const { providerSource, error } = await resolveAuth(token, providerTokenHeader, ip);
    if (error) return res.status(error.status).json(error.body);

    const existingMovement = await getExistingMovementByKeys(movementPayload, providerEventId);
    const hints = collectDestinationHints(wrapper, movementPayload);
    let resolveResult;

    if (hints.hasExplicitDestinationHints) {
      resolveResult = await resolveDestinationsForWebhook({ wrapper, movementPayload, allowAccountFallback: true });
    } else if (existingMovement) {
      const existingDomains = await getExistingDomainsForMovement(existingMovement.id, existingMovement.domain_id);
      resolveResult = buildStoredResolutionResult(existingMovement, existingDomains);
    } else {
      resolveResult = await resolveDestinationsForWebhook({ wrapper, movementPayload, allowAccountFallback: true });
    }

    const saveResult = existingMovement
      ? await updateMovement(movementPayload, resolveResult, {
        providerEventId,
        token,
        providerSourceId: providerSource?.id || null,
        receivedByProviderAt,
        rawPayload: body,
        destinationDomainRaw: resolveResult.destinationDomainRaw,
        destinationDomainsRaw: resolveResult.destinationDomainsRaw,
        providerStatus,
        preserveResolution: !hints.hasExplicitDestinationHints && !!existingMovement,
      })
      : await saveMovement(movementPayload, resolveResult, {
        providerEventId,
        token,
        providerSourceId: providerSource?.id || null,
        receivedByProviderAt,
        rawPayload: body,
        destinationDomainRaw: resolveResult.destinationDomainRaw,
        destinationDomainsRaw: resolveResult.destinationDomainsRaw,
        providerStatus,
      });

    const movementId = saveResult.id;

    res.status(200).json({ success: true, message: 'Webhook update received', gateway_event_id: providerEventId || null });

    setImmediate(async () => {
      try {
        const movement = await processPersistedMovement({
          movementId,
          providerSourceId: providerSource?.id,
          requestId: req.requestId,
          ip,
          resolved: resolveResult.resolved,
          movementPayload,
          resolveResult,
          socketEvent: 'movement:updated',
          requeueExistingDeliveries: true,
          deliveryKind: 'update',
        });

        if (movement) {
          logService.info({
            source: 'webhookController',
            event_type: 'movement_updated',
            request_id: req.requestId,
            gateway_event_id: movement.gateway_event_id,
            provider_source_id: providerSource?.id || null,
            movement_id: movementId,
            message: `Movement updated with resolution ${resolveResult.resolutionStatus}`,
            ip_address: ip,
            metadata: {
              destination_domain_raw: resolveResult.destinationDomainRaw || null,
              destination_domains_raw: resolveResult.destinationDomainsRaw || null,
              resolution_method: resolveResult.method,
              provider_status: providerStatus,
            },
          });
        }
      } catch (err) {
        logger.error('Error processing webhook update async:', err);
        logService.error({
          source: 'webhookController',
          event_type: 'webhook_processing_error',
          request_id: req.requestId,
          gateway_event_id: providerEventId || null,
          message: err.message,
          ip_address: ip,
        });
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { receiveWebhook, receiveWebhookUpdate };
