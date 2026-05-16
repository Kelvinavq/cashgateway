const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function resolveAccount(payload) {
  const { accountId, toCUIT, toCBU, coelsaCode } = payload;

  // Strategy 1: by accountId
  if (accountId) {
    const [rows] = await pool.query(
      'SELECT a.*, d.id as domain_id, d.name as domain_name, d.destination_webhook_url, d.destination_token FROM hgcash_accounts a LEFT JOIN domains d ON a.domain_id = d.id WHERE a.account_id = ? AND a.is_active = 1 LIMIT 1',
      [accountId]
    );
    if (rows[0]) {
      logger.info(`Account resolved by accountId: ${accountId}`);
      return rows[0];
    }
  }

  // Strategy 2: by toCUIT
  if (toCUIT) {
    const [rows] = await pool.query(
      'SELECT a.*, d.id as domain_id, d.name as domain_name, d.destination_webhook_url, d.destination_token FROM hgcash_accounts a LEFT JOIN domains d ON a.domain_id = d.id WHERE a.cuit = ? AND a.is_active = 1 LIMIT 1',
      [toCUIT]
    );
    if (rows[0]) {
      logger.info(`Account resolved by CUIT: ${toCUIT}`);
      return rows[0];
    }
  }

  // Strategy 3: by toCBU
  if (toCBU) {
    const [rows] = await pool.query(
      'SELECT a.*, d.id as domain_id, d.name as domain_name, d.destination_webhook_url, d.destination_token FROM hgcash_accounts a LEFT JOIN domains d ON a.domain_id = d.id WHERE a.cbu = ? AND a.is_active = 1 LIMIT 1',
      [toCBU]
    );
    if (rows[0]) {
      logger.info(`Account resolved by CBU: ${toCBU}`);
      return rows[0];
    }
  }

  logger.warn(`Could not resolve account for payload: accountId=${accountId}, toCUIT=${toCUIT}, toCBU=${toCBU}`);
  return null;
}

module.exports = { resolveAccount };
