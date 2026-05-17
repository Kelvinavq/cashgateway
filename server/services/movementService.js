const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function saveMovement(payload, account, token) {
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
  } = payload;

  const now = new Date();

  // Check for duplicate
  const [existing] = await pool.query('SELECT id FROM movements WHERE hg_id = ? LIMIT 1', [hg_id]);
  if (existing[0]) {
    logger.info(`Duplicate movement ignored: hg_id=${hg_id}`);
    return { duplicate: true, id: existing[0].id };
  }

  const [result] = await pool.query(
    `INSERT INTO movements
      (hg_id, external_id, account_id, hgcash_account_id, domain_id, amount, currency, direction, status, type,
       movement_date, timezone, from_name, to_name, from_cbu, to_cbu, from_cuit, to_cuit, coelsa_code,
       provider_token_id, received_from_provider_at, raw_payload, received_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      hg_id,
      externalID || null,
      accountId || null,
      account ? account.id : null,
      account ? account.domain_id : null,
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
      token || null,
      now,
      JSON.stringify(payload),
    ]
  );

  logger.info(`Movement saved: id=${result.insertId}, hg_id=${hg_id}`);
  return { duplicate: false, id: result.insertId };
}

async function updateMovement(payload, account, token) {
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
  } = payload;

  const [existing] = await pool.query(
    'SELECT id FROM movements WHERE hg_id = ? OR (coelsa_code = ? AND coelsa_code IS NOT NULL) LIMIT 1',
    [hg_id || null, coelsaCode || null]
  );

  if (!existing[0]) {
    return saveMovement(payload, account, token);
  }

  const movementId = existing[0].id;

  await pool.query(
    `UPDATE movements SET
      external_id = COALESCE(?, external_id),
      account_id = COALESCE(?, account_id),
      hgcash_account_id = COALESCE(?, hgcash_account_id),
      domain_id = COALESCE(?, domain_id),
      amount = COALESCE(?, amount),
      currency = COALESCE(?, currency),
      direction = COALESCE(?, direction),
      status = COALESCE(?, status),
      type = COALESCE(?, type),
      movement_date = COALESCE(?, movement_date),
      timezone = COALESCE(?, timezone),
      from_name = COALESCE(?, from_name),
      to_name = COALESCE(?, to_name),
      from_cbu = COALESCE(?, from_cbu),
      to_cbu = COALESCE(?, to_cbu),
      from_cuit = COALESCE(?, from_cuit),
      to_cuit = COALESCE(?, to_cuit),
      coelsa_code = COALESCE(?, coelsa_code),
      provider_token_id = COALESCE(?, provider_token_id),
      raw_payload = ?,
      updated_at = NOW()
     WHERE id = ?`,
    [
      externalID || null,
      accountId || null,
      account ? account.id : null,
      account ? account.domain_id : null,
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
      token || null,
      JSON.stringify(payload),
      movementId,
    ]
  );

  logger.info(`Movement updated: id=${movementId}, hg_id=${hg_id || 'n/a'}`);
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
