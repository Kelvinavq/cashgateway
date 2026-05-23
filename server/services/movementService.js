const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * @param {object} movementPayload  - Normalized HG.Cash movement fields
 * @param {object} resolveResult    - Result from resolveAccountForMovement
 * @param {object} meta             - { providerEventId, gatewayEventId, token }
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

  const { providerEventId = null, gatewayEventId, token = null, providerSourceId = null } = meta;
  const { resolved, method, account, reason } = resolveResult;

  const now = new Date();

  // Dedup by hg_id (primary) or provider_event_id (secondary, when provided)
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

  const [result] = await pool.query(
    `INSERT INTO movements
      (provider_source_id, provider_event_id, gateway_event_id,
       hg_id, external_id, account_id, hgcash_account_id, domain_id,
       amount, currency, direction, status, type,
       movement_date, timezone, from_name, to_name,
       from_cbu, to_cbu, from_cuit, to_cuit, coelsa_code,
       resolution_status, resolution_method, unresolved_reason,
       provider_token_id, received_from_provider_at, raw_payload, received_at,
       created_at, updated_at)
     VALUES
      (?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?,
       ?, ?, ?, ?,
       NOW(), NOW())`,
    [
      providerSourceId || null,
      providerEventId,
      gatewayEventId,
      hg_id,
      externalID || null,
      accountId || null,
      resolved && account ? account.id : null,
      resolved && account ? account.domain_id : null,
      parseFloat(amount) || 0,
      currency || 'ARS',
      direction || 'Inbound',
      status || 'done',
      type || 'inbound',
      date ? new Date(date) : now,
      timezone || null,
      fromName || null,
      toName || null,
      fromCBU || null,
      toCBU || null,
      fromCUIT || null,
      toCUIT || null,
      coelsaCode || null,
      resolved ? 'resolved' : 'unresolved',
      method || 'none',
      resolved ? null : (reason || null),
      token || null,
      now,
      JSON.stringify(movementPayload),
      now,
    ]
  );

  logger.info(`Movement saved: id=${result.insertId}, hg_id=${hg_id}, resolution=${resolved ? 'resolved' : 'unresolved'}`);
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

  const { token = null } = meta;
  const { resolved, method, account } = resolveResult;

  const [existing] = await pool.query(
    'SELECT id, resolution_status FROM movements WHERE hg_id = ? OR (coelsa_code = ? AND coelsa_code IS NOT NULL) LIMIT 1',
    [hg_id || null, coelsaCode || null]
  );

  if (!existing[0]) {
    return saveMovement(movementPayload, resolveResult, meta);
  }

  const movementId = existing[0].id;
  const currentStatus = existing[0].resolution_status;

  // Only update resolution if previously unresolved and now can be resolved
  const newResolutionStatus = (currentStatus === 'unresolved' && resolved) ? 'resolved' : currentStatus;
  const newResolutionMethod = (currentStatus === 'unresolved' && resolved) ? method : null;

  await pool.query(
    `UPDATE movements SET
      external_id          = COALESCE(?, external_id),
      account_id           = COALESCE(?, account_id),
      hgcash_account_id    = COALESCE(?, hgcash_account_id),
      domain_id            = COALESCE(?, domain_id),
      amount               = COALESCE(?, amount),
      currency             = COALESCE(?, currency),
      direction            = COALESCE(?, direction),
      status               = COALESCE(?, status),
      type                 = COALESCE(?, type),
      movement_date        = COALESCE(?, movement_date),
      timezone             = COALESCE(?, timezone),
      from_name            = COALESCE(?, from_name),
      to_name              = COALESCE(?, to_name),
      from_cbu             = COALESCE(?, from_cbu),
      to_cbu               = COALESCE(?, to_cbu),
      from_cuit            = COALESCE(?, from_cuit),
      to_cuit              = COALESCE(?, to_cuit),
      coelsa_code          = COALESCE(?, coelsa_code),
      resolution_status    = ?,
      resolution_method    = COALESCE(?, resolution_method),
      unresolved_reason    = IF(? = 'resolved', NULL, unresolved_reason),
      provider_token_id    = COALESCE(?, provider_token_id),
      raw_payload          = ?,
      updated_at           = NOW()
     WHERE id = ?`,
    [
      externalID || null,
      accountId || null,
      resolved && account ? account.id : null,
      resolved && account ? account.domain_id : null,
      amount !== undefined && amount !== null ? parseFloat(amount) || 0 : null,
      currency || null,
      direction || null,
      status || null,
      type || null,
      date ? new Date(date) : null,
      timezone || null,
      fromName || null,
      toName || null,
      fromCBU || null,
      toCBU || null,
      fromCUIT || null,
      toCUIT || null,
      coelsaCode || null,
      newResolutionStatus,
      newResolutionMethod,
      newResolutionStatus,
      token || null,
      JSON.stringify(movementPayload),
      movementId,
    ]
  );

  logger.info(`Movement updated: id=${movementId}, resolution=${newResolutionStatus}`);
  return { duplicate: false, id: movementId, updated: true };
}

async function createDelivery(movementId, domainId, destinationUrl) {
  const [result] = await pool.query(
    "INSERT INTO webhook_deliveries (movement_id, domain_id, destination_url, status, attempts) VALUES (?, ?, ?, 'pending', 0)",
    [movementId, domainId, destinationUrl]
  );
  return result.insertId;
}

module.exports = { saveMovement, updateMovement, createDelivery };
