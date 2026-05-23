const { pool } = require('../config/database');
const logger = require('../utils/logger');

const SELECT_WITH_DOMAIN = `
  SELECT a.*,
    d.id           AS domain_id,
    d.name         AS domain_name,
    d.destination_webhook_url,
    d.destination_token,
    d.is_active    AS domain_is_active
  FROM hgcash_accounts a
  LEFT JOIN domains d ON a.domain_id = d.id
  WHERE d.is_active = 1 AND a.is_active = 1
`;

function buildResult(method, row) {
  const domain = {
    id: row.domain_id,
    name: row.domain_name,
    destination_webhook_url: row.destination_webhook_url,
    destination_token: row.destination_token,
  };
  return { resolved: true, method, account: row, domain };
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
    const [rows] = await pool.query(
      `${SELECT_WITH_DOMAIN} AND a.account_id = ? LIMIT 1`,
      [accountId]
    );
    if (rows[0]) {
      logger.info(`Account resolved by accountId: ${accountId}`);
      return buildResult('account_id', rows[0]);
    }
  }

  if (toCBU) {
    const [rows] = await pool.query(
      `${SELECT_WITH_DOMAIN} AND a.cbu = ? LIMIT 1`,
      [toCBU]
    );
    if (rows[0]) {
      logger.info(`Account resolved by toCBU: ${toCBU}`);
      return buildResult('to_cbu', rows[0]);
    }
  }

  if (toCUIT) {
    const [rows] = await pool.query(
      `${SELECT_WITH_DOMAIN} AND a.cuit = ? LIMIT 1`,
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
