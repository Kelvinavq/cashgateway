const { pool } = require('../config/database');
const { generateToken } = require('../utils/hmac');

const SAFE_FIELDS = 'id, name, slug, base_url, destination_webhook_url, destination_token, gateway_signing_secret, require_ack, is_active, created_at, updated_at';

async function list(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT ${SAFE_FIELDS} FROM domains ORDER BY created_at DESC`);
    // Mask signing secret
    const data = rows.map(r => ({
      ...r,
      gateway_signing_secret: r.gateway_signing_secret
        ? `${r.gateway_signing_secret.substring(0, 8)}...`
        : null,
      has_signing_secret: !!r.gateway_signing_secret,
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, slug, base_url, destination_webhook_url, destination_token, require_ack = 0, is_active = 1 } = req.body;
    const gateway_signing_secret = generateToken(32);
    const [result] = await pool.query(
      'INSERT INTO domains (name, slug, base_url, destination_webhook_url, destination_token, gateway_signing_secret, require_ack, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, slug, base_url, destination_webhook_url, destination_token || null, gateway_signing_secret, require_ack ? 1 : 0, is_active ? 1 : 0]
    );
    const [rows] = await pool.query(`SELECT ${SAFE_FIELDS} FROM domains WHERE id = ?`, [result.insertId]);
    // Return full secret once on creation
    res.status(201).json({ success: true, data: { ...rows[0], gateway_signing_secret } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Slug already exists' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, slug, base_url, destination_webhook_url, destination_token, require_ack, is_active } = req.body;
    const [result] = await pool.query(
      'UPDATE domains SET name=?, slug=?, base_url=?, destination_webhook_url=?, destination_token=?, require_ack=?, is_active=?, updated_at=NOW() WHERE id=?',
      [name, slug, base_url, destination_webhook_url, destination_token || null, require_ack ? 1 : 0, is_active ? 1 : 0, id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Domain not found' });
    const [rows] = await pool.query(`SELECT ${SAFE_FIELDS} FROM domains WHERE id = ?`, [id]);
    res.json({
      success: true,
      data: {
        ...rows[0],
        gateway_signing_secret: rows[0].gateway_signing_secret
          ? `${rows[0].gateway_signing_secret.substring(0, 8)}...`
          : null,
        has_signing_secret: !!rows[0].gateway_signing_secret,
      },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
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
