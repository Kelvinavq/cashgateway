const { pool } = require('../config/database');
const { generateToken } = require('../utils/hmac');
const env = require('../config/env');

async function list(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, d.name as domain_name, d.slug as domain_slug
      FROM hgcash_accounts a
      LEFT JOIN domains d ON a.domain_id = d.id
      ORDER BY a.created_at DESC
    `);
    const data = rows.map(r => ({
      ...r,
      webhook_url: `${env.publicWebhookBaseUrl}/api/webhooks/provider/hgcash/${r.gateway_token}`,
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, account_id, cuit, cbu, alias, domain_id, webhook_secret, provider_token, is_active = 1 } = req.body;
    const gateway_token = generateToken(24);
    const [result] = await pool.query(
      'INSERT INTO hgcash_accounts (name, account_id, cuit, cbu, alias, domain_id, webhook_secret, gateway_token, provider_token, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, account_id, cuit, cbu, alias || null, domain_id, webhook_secret || null, gateway_token, provider_token || null, is_active ? 1 : 0]
    );
    const [rows] = await pool.query(
      'SELECT a.*, d.name as domain_name FROM hgcash_accounts a LEFT JOIN domains d ON a.domain_id = d.id WHERE a.id = ?',
      [result.insertId]
    );
    const account = { ...rows[0], webhook_url: `${env.publicWebhookBaseUrl}/api/webhooks/provider/hgcash/${gateway_token}` };
    res.status(201).json({ success: true, data: account });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'account_id already exists' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, cuit, cbu, alias, domain_id, webhook_secret, provider_token, is_active } = req.body;
    const [result] = await pool.query(
      'UPDATE hgcash_accounts SET name=?, cuit=?, cbu=?, alias=?, domain_id=?, webhook_secret=?, provider_token=?, is_active=?, updated_at=NOW() WHERE id=?',
      [name, cuit, cbu, alias || null, domain_id, webhook_secret || null, provider_token || null, is_active ? 1 : 0, id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Account not found' });
    const [rows] = await pool.query(
      'SELECT a.*, d.name as domain_name FROM hgcash_accounts a LEFT JOIN domains d ON a.domain_id = d.id WHERE a.id = ?',
      [id]
    );
    const account = { ...rows[0], webhook_url: `${env.publicWebhookBaseUrl}/api/webhooks/provider/hgcash/${rows[0].gateway_token}` };
    res.json({ success: true, data: account });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM hgcash_accounts WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
