const { pool } = require('../config/database');
const { hasColumn } = require('../services/schemaService');
const { generateToken } = require('../utils/hmac');
const { normalizeDomain } = require('../utils/domainNormalizer');

function resolveHostname(baseUrl, explicitHostname) {
  return normalizeDomain(explicitHostname) || normalizeDomain(baseUrl);
}

async function getSafeFields() {
  const hasHostname = await hasColumn('domains', 'hostname');
  return hasHostname
    ? 'id, name, slug, base_url, hostname, destination_webhook_url, destination_token, gateway_signing_secret, require_ack, is_active, created_at, updated_at'
    : 'id, name, slug, base_url, destination_webhook_url, destination_token, gateway_signing_secret, require_ack, is_active, created_at, updated_at';
}

function hydrateDomainRow(row) {
  if (!row) return row;
  return {
    ...row,
    hostname: row.hostname || normalizeDomain(row.base_url) || null,
  };
}

async function list(req, res, next) {
  try {
    const safeFields = await getSafeFields();
    const [rows] = await pool.query(`SELECT ${safeFields} FROM domains ORDER BY created_at DESC`);
    // Mask signing secret
    const data = rows.map(r => {
      const row = hydrateDomainRow(r);
      return {
        ...row,
        gateway_signing_secret: row.gateway_signing_secret
          ? `${row.gateway_signing_secret.substring(0, 8)}...`
          : null,
        has_signing_secret: !!row.gateway_signing_secret,
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, slug, base_url, hostname: explicitHostname, destination_webhook_url, destination_token, require_ack = 0, is_active = 1 } = req.body;
    const gateway_signing_secret = generateToken(32);
    const hostname = resolveHostname(base_url, explicitHostname);
    const hasHostname = await hasColumn('domains', 'hostname');
    if (!hostname && hasHostname) {
      return res.status(422).json({ success: false, message: 'Valid hostname required' });
    }
    const fields = hasHostname
      ? '(name, slug, base_url, hostname, destination_webhook_url, destination_token, gateway_signing_secret, require_ack, is_active)'
      : '(name, slug, base_url, destination_webhook_url, destination_token, gateway_signing_secret, require_ack, is_active)';
    const values = hasHostname
      ? [name, slug, base_url, hostname, destination_webhook_url, destination_token || null, gateway_signing_secret, require_ack ? 1 : 0, is_active ? 1 : 0]
      : [name, slug, base_url, destination_webhook_url, destination_token || null, gateway_signing_secret, require_ack ? 1 : 0, is_active ? 1 : 0];
    const [result] = await pool.query(
      `INSERT INTO domains ${fields} VALUES (${values.map(() => '?').join(', ')})`,
      values
    );
    const safeFields = await getSafeFields();
    const [rows] = await pool.query(`SELECT ${safeFields} FROM domains WHERE id = ?`, [result.insertId]);
    // Return full secret once on creation
    res.status(201).json({ success: true, data: { ...hydrateDomainRow(rows[0]), gateway_signing_secret } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      if (String(err.sqlMessage || '').includes('uq_domains_hostname')) {
        return res.status(409).json({ success: false, message: 'Hostname already exists' });
      }
      return res.status(409).json({ success: false, message: 'Slug already exists' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, slug, base_url, hostname: explicitHostname, destination_webhook_url, destination_token, require_ack, is_active } = req.body;
    const hostname = resolveHostname(base_url, explicitHostname);
    const hasHostname = await hasColumn('domains', 'hostname');
    if (!hostname && hasHostname) {
      return res.status(422).json({ success: false, message: 'Valid hostname required' });
    }
    const setParts = hasHostname
      ? 'name=?, slug=?, base_url=?, hostname=?, destination_webhook_url=?, destination_token=?, require_ack=?, is_active=?, updated_at=NOW()'
      : 'name=?, slug=?, base_url=?, destination_webhook_url=?, destination_token=?, require_ack=?, is_active=?, updated_at=NOW()';
    const values = hasHostname
      ? [name, slug, base_url, hostname, destination_webhook_url, destination_token || null, require_ack ? 1 : 0, is_active ? 1 : 0, id]
      : [name, slug, base_url, destination_webhook_url, destination_token || null, require_ack ? 1 : 0, is_active ? 1 : 0, id];
    const [result] = await pool.query(
      `UPDATE domains SET ${setParts} WHERE id=?`,
      values
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Domain not found' });
    const safeFields = await getSafeFields();
    const [rows] = await pool.query(`SELECT ${safeFields} FROM domains WHERE id = ?`, [id]);
    res.json({
      success: true,
      data: {
        ...hydrateDomainRow(rows[0]),
        gateway_signing_secret: rows[0].gateway_signing_secret
          ? `${rows[0].gateway_signing_secret.substring(0, 8)}...`
          : null,
        has_signing_secret: !!rows[0].gateway_signing_secret,
      },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      if (String(err.sqlMessage || '').includes('uq_domains_hostname')) {
        return res.status(409).json({ success: false, message: 'Hostname already exists' });
      }
      return res.status(409).json({ success: false, message: 'Slug already exists' });
    }
    next(err);
  }
}

async function regenerateSigningSecret(req, res, next) {
  try {
    const { id } = req.params;
    const newSecret = generateToken(32);
    const [result] = await pool.query(
      'UPDATE domains SET gateway_signing_secret=?, updated_at=NOW() WHERE id=?',
      [newSecret, id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Domain not found' });
    res.json({ success: true, gateway_signing_secret: newSecret });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM domains WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Domain not found' });
    res.json({ success: true, message: 'Domain deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, regenerateSigningSecret, remove };
