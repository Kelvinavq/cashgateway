const { pool } = require('../config/database');
const { hasColumn } = require('./schemaService');
const logger = require('../utils/logger');

function buildResult(method, row) {
  const domain = {
    id: row.domain_id,
    name: row.domain_name,
    hostname: row.domain_hostname || null,
    destination_webhook_url: row.destination_webhook_url,
    destination_token: row.destination_token,
  };
  return { resolved: true, method, account: row, domain };
}

async function buildSelectWithDomain() {
  const hasDomainHostname = await hasColumn('domains', 'hostname');
  return `
    SELECT a.*,
      d.id           AS domain_id,
      d.name         AS domain_name,
      ${hasDomainHostname ? 'd.hostname AS domain_hostname' : 'NULL AS domain_hostname'},
      d.destination_webhook_url,
      d.destination_token,
      d.is_active    AS domain_is_active
    FROM hgcash_accounts a
    LEFT JOIN domains d ON a.domain_id = d.id
    WHERE d.is_active = 1 AND a.is_active = 1
  `;
}

/**
 * Resolve which HG.Cash account and domain a movement payload belongs to.
 * Priority: accountId → toCBU → toCUIT
 * Returns { resolved, method, account, domain } on success
 * Returns { resolved: false, method: 'none', reason } on failure
 */
async function resolveAccountForMovement(movementPayload) {
  const { accountId, toCBU, toCUIT } = movementPayload;

  if (accountId) {
    const selectWithDomain = await buildSelectWithDomain();
    const [rows] = await pool.query(
      `${selectWithDomain} AND a.account_id = ? LIMIT 1`,
      [accountId]
    );
    if (rows[0]) {
      logger.info(`Account resolved by accountId: ${accountId}`);
      return buildResult('account_id', rows[0]);
    }
  }

  if (toCBU) {
    const selectWithDomain = await buildSelectWithDomain();
    const [rows] = await pool.query(
      `${selectWithDomain} AND a.cbu = ? LIMIT 1`,
      [toCBU]
    );
    if (rows[0]) {
      logger.info(`Account resolved by toCBU: ${toCBU}`);
      return buildResult('to_cbu', rows[0]);
    }
  }

  if (toCUIT) {
    const selectWithDomain = await buildSelectWithDomain();
    const [rows] = await pool.query(
      `${selectWithDomain} AND a.cuit = ? LIMIT 1`,
      [toCUIT]
    );
    if (rows[0]) {
      logger.info(`Account resolved by toCUIT: ${toCUIT}`);
      return buildResult('to_cuit', rows[0]);
    }
  }

  const reason = `No account found for accountId=${accountId || 'n/a'}, toCBU=${toCBU || 'n/a'}, toCUIT=${toCUIT || 'n/a'}`;
  logger.warn(`Could not resolve account: ${reason}`);
  return { resolved: false, method: 'none', reason };
}

// Legacy alias kept for backward compatibility with any direct callers
async function resolveAccount(payload) {
  const result = await resolveAccountForMovement(payload);
  return result.resolved ? result.account : null;
}

module.exports = { resolveAccountForMovement, resolveAccount };
