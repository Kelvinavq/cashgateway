const { pool } = require('../config/database');
const { hasColumn } = require('./schemaService');
const logger = require('../utils/logger');

const PROVIDER_STATUSES = new Set(['pending', 'paid', 'rejected']);

function normalizeProviderStatus(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  return PROVIDER_STATUSES.has(normalized) ? normalized : null;
}

function toDate(value, fallback = null) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function getResolutionSnapshot(resolveResult = {}, fallbackAccount = null) {
  const hasResolvedDomains = Array.isArray(resolveResult.domains) && resolveResult.domains.length > 0;
  const primaryDomain = hasResolvedDomains ? resolveResult.domains[0] : null;
  const resolved = !!resolveResult.resolved;
  const method = resolveResult.method || 'none';

  return {
    resolved,
    method,
    resolutionStatus: resolveResult.resolutionStatus || (resolved ? 'resolved' : 'unresolved'),
    domains: resolveResult.domains || [],
    account: resolveResult.account || fallbackAccount || null,
    reason: resolveResult.unresolvedReason || resolveResult.reason || null,
    primaryDomain,
  };
}

/**
 * @param {object} movementPayload  - Normalized HG.Cash movement fields
 * @param {object} resolveResult    - Result from resolveDestinationsForWebhook / manual resolution
 * @param {object} meta             - Extra metadata from controller
 */
async function saveMovement(movementPayload, resolveResult, meta = {}) {
  const {
    id: hg_id,
    externalID,
    amount,
    currency,
    direction,
    status,
    type,
    date,
    timezone,
    fromName,
    toName,
    fromCBU,
    toCBU,
    fromCUIT,
    toCUIT,
    coelsaCode,
    accountId,
  } = movementPayload;

  const {
    providerEventId = null,
    gatewayEventId,
    token = null,
    providerSourceId = null,
    receivedByProviderAt = null,
    rawPayload = null,
    destinationDomainRaw = null,
    destinationDomainsRaw = null,
    providerStatus = null,
  } = meta;

  const snapshot = getResolutionSnapshot(resolveResult);
  const { resolved, method, account, reason, domains, resolutionStatus, primaryDomain } = snapshot;
  const now = new Date();
  const movementDate = toDate(date, now);
  const receivedAt = toDate(receivedByProviderAt, now);
  const destinationDomainId = primaryDomain?.id || (resolved && account ? account.domain_id : null);
  const hasProviderStatus = await hasColumn('movements', 'provider_status');
  const normalizedProviderStatus = normalizeProviderStatus(providerStatus);

  const [existing] = await pool.query(
    'SELECT id, gateway_event_id FROM movements WHERE hg_id = ? LIMIT 1',
    [hg_id]
  );
  if (existing[0]) {
    logger.info(`Duplicate movement ignored: hg_id=${hg_id}`);
    return { duplicate: true, id: existing[0].id, gatewayEventId: existing[0].gateway_event_id };
  }

  if (providerEventId) {
    const [existingProv] = await pool.query(
      'SELECT id, gateway_event_id FROM movements WHERE provider_event_id = ? LIMIT 1',
      [providerEventId]
    );
    if (existingProv[0]) {
      logger.info(`Duplicate movement ignored: provider_event_id=${providerEventId}`);
      return { duplicate: true, id: existingProv[0].id, gatewayEventId: existingProv[0].gateway_event_id };
    }
  }

  const columns = [
    'provider_source_id', 'provider_event_id', 'gateway_event_id',
    'hg_id', 'external_id', 'account_id', 'hgcash_account_id', 'domain_id',
    'amount', 'currency', 'direction', 'status', 'type',
    'movement_date', 'timezone', 'from_name', 'to_name',
    'from_cbu', 'to_cbu', 'from_cuit', 'to_cuit', 'coelsa_code',
    'destination_domain_raw', 'destination_domains_raw',
    'resolution_status', 'resolution_method', 'unresolved_reason',
    'provider_token_id', 'received_from_provider_at', 'raw_payload', 'received_at',
  ];
  const values = [
    providerSourceId || null,
    providerEventId,
    gatewayEventId,
    hg_id,
    externalID || null,
    accountId || null,
    resolved && account ? account.id : null,
    destinationDomainId,
    parseFloat(amount) || 0,
    currency || 'ARS',
    direction || 'Inbound',
    status || 'done',
    type || 'inbound',
    movementDate,
    timezone || null,
    fromName || null,
    toName || null,
    fromCBU || null,
    toCBU || null,
    fromCUIT || null,
    toCUIT || null,
    coelsaCode || null,
    destinationDomainRaw || null,
    destinationDomainsRaw ? JSON.stringify(destinationDomainsRaw) : null,
    resolutionStatus,
    method || 'none',
    resolved ? null : (reason || null),
    token || null,
    receivedAt,
    JSON.stringify(rawPayload || movementPayload),
    now,
  ];

  if (hasProviderStatus) {
    columns.splice(25, 0, 'provider_status');
    values.splice(25, 0, normalizedProviderStatus);
  }

  const [result] = await pool.query(
    `INSERT INTO movements (${columns.join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})`,
    values
  );

  logger.info(`Movement saved: id=${result.insertId}, hg_id=${hg_id}, resolution=${resolutionStatus}`);
  return { duplicate: false, id: result.insertId };
}

async function updateMovement(movementPayload, resolveResult, meta = {}) {
  const {
    id: hg_id,
    externalID,
    amount,
    currency,
    direction,
    status,
    type,
    date,
    timezone,
    fromName,
    toName,
    fromCBU,
    toCBU,
    fromCUIT,
    toCUIT,
    coelsaCode,
    accountId,
  } = movementPayload;

  const {
    token = null,
    providerEventId = null,
    providerSourceId = null,
    receivedByProviderAt = null,
    rawPayload = null,
    destinationDomainRaw = null,
    destinationDomainsRaw = null,
    providerStatus = undefined,
    preserveResolution = false,
  } = meta;

  const snapshot = getResolutionSnapshot(resolveResult);
  const { resolved, method, account, reason, domains, resolutionStatus, primaryDomain } = snapshot;
  const [existing] = await pool.query(
    'SELECT id, resolution_status, resolution_method, domain_id FROM movements WHERE hg_id = ? OR (coelsa_code = ? AND coelsa_code IS NOT NULL) OR (provider_event_id = ? AND provider_event_id IS NOT NULL) LIMIT 1',
    [hg_id || null, coelsaCode || null, providerEventId || null]
  );

  if (!existing[0]) {
    return saveMovement(movementPayload, resolveResult, meta);
  }

  const movementId = existing[0].id;
  const currentStatus = existing[0].resolution_status;
  const currentMethod = existing[0].resolution_method;
  const currentDomainId = existing[0].domain_id;
  const nextMovementDate = date ? toDate(date, null) : null;
  const nextReceivedAt = receivedByProviderAt ? toDate(receivedByProviderAt, null) : null;
  const hasProviderStatus = await hasColumn('movements', 'provider_status');
  const normalizedProviderStatus = normalizeProviderStatus(providerStatus);

  const resolutionColumns = preserveResolution
    ? {
        domainId: currentDomainId,
        resolutionStatus: currentStatus,
        resolutionMethod: currentMethod,
        unresolvedReason: reason || null,
        destinationDomainRaw: resolveResult.destinationDomainRaw || null,
        destinationDomainsRaw: resolveResult.destinationDomainsRaw || null,
      }
    : {
        domainId: (resolved && account ? account.domain_id : (primaryDomain?.id || null)),
        resolutionStatus,
        resolutionMethod: method || 'none',
        unresolvedReason: resolved ? null : (reason || null),
        destinationDomainRaw,
        destinationDomainsRaw,
      };

  const setParts = [
    'external_id = COALESCE(?, external_id)',
    'account_id = COALESCE(?, account_id)',
    'hgcash_account_id = COALESCE(?, hgcash_account_id)',
    'domain_id = ?',
    'amount = COALESCE(?, amount)',
    'currency = COALESCE(?, currency)',
    'direction = COALESCE(?, direction)',
    'status = COALESCE(?, status)',
    'type = COALESCE(?, type)',
    'movement_date = COALESCE(?, movement_date)',
    'timezone = COALESCE(?, timezone)',
    'from_name = COALESCE(?, from_name)',
    'to_name = COALESCE(?, to_name)',
    'from_cbu = COALESCE(?, from_cbu)',
    'to_cbu = COALESCE(?, to_cbu)',
    'from_cuit = COALESCE(?, from_cuit)',
    'to_cuit = COALESCE(?, to_cuit)',
    'coelsa_code = COALESCE(?, coelsa_code)',
    'destination_domain_raw = ?',
    'destination_domains_raw = ?',
    'resolution_status = ?',
    'resolution_method = ?',
    'unresolved_reason = ?',
  ];

  const params = [
    externalID || null,
    accountId || null,
    resolved && account ? account.id : null,
    resolutionColumns.domainId,
    amount !== undefined && amount !== null ? parseFloat(amount) || 0 : null,
    currency || null,
    direction || null,
    status || null,
    type || null,
    nextMovementDate,
    timezone || null,
    fromName || null,
    toName || null,
    fromCBU || null,
    toCBU || null,
    fromCUIT || null,
    toCUIT || null,
    coelsaCode || null,
    resolutionColumns.destinationDomainRaw || null,
    resolutionColumns.destinationDomainsRaw ? JSON.stringify(resolutionColumns.destinationDomainsRaw) : null,
    resolutionColumns.resolutionStatus,
    resolutionColumns.resolutionMethod,
    resolutionColumns.unresolvedReason,
  ];

  if (hasProviderStatus) {
    setParts.push('provider_status = COALESCE(?, provider_status)');
    params.push(normalizedProviderStatus);
  }

  setParts.push(
    'provider_token_id = COALESCE(?, provider_token_id)',
    'provider_source_id = COALESCE(?, provider_source_id)',
    'received_from_provider_at = COALESCE(?, received_from_provider_at)',
    'raw_payload = ?',
    'updated_at = NOW()'
  );

  params.push(
    token || null,
    providerSourceId || null,
    nextReceivedAt,
    JSON.stringify(rawPayload || movementPayload),
  );

  params.push(movementId);

  await pool.query(
    `UPDATE movements SET ${setParts.join(', ')} WHERE id = ?`,
    params
  );

  logger.info(`Movement updated: id=${movementId}, resolution=${resolutionColumns.resolutionStatus}`);
  return { duplicate: false, id: movementId, updated: true };
}

async function createDelivery(movementId, domainId, destinationUrl, providerStatus = null, deliveryKind = 'initial') {
  const hasProviderStatus = await hasColumn('webhook_deliveries', 'provider_status');
  const hasDeliveryKind = await hasColumn('webhook_deliveries', 'delivery_kind');
  const columns = ['movement_id', 'domain_id', 'destination_url', 'status', 'attempts'];
  const values = [movementId, domainId, destinationUrl, 'pending', 0];

  if (hasProviderStatus) {
    columns.splice(3, 0, 'provider_status');
    values.splice(3, 0, normalizeProviderStatus(providerStatus));
  }
  if (hasDeliveryKind) {
    const insertAt = hasProviderStatus ? 4 : 3;
    columns.splice(insertAt, 0, 'delivery_kind');
    values.splice(insertAt, 0, deliveryKind || 'initial');
  }

  const [result] = await pool.query(
    `INSERT IGNORE INTO webhook_deliveries
      (${columns.join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})`,
    values
  );

  if (!result.affectedRows) {
    return { created: false, insertId: null };
  }

  return { created: true, insertId: result.insertId };
}

async function syncDeliveriesForMovement(movementId, domains = [], providerStatus = null, deliveryKind = 'initial') {
  const uniqueDomains = [];
  const seen = new Set();

  for (const domain of domains) {
    if (!domain?.id || !domain?.destination_webhook_url) continue;
    const key = String(domain.id);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueDomains.push(domain);
  }

  const created = [];
  const skipped = [];

  for (const domain of uniqueDomains) {
    const result = await createDelivery(movementId, domain.id, domain.destination_webhook_url, providerStatus, deliveryKind);
    if (result.created) {
      created.push({ domainId: domain.id, deliveryId: result.insertId });
    } else {
      skipped.push(domain.id);
    }
  }

  return { created, skipped };
}

module.exports = {
  saveMovement,
  updateMovement,
  createDelivery,
  syncDeliveriesForMovement,
};
