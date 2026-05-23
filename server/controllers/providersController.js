const { pool } = require('../config/database');
const { generateToken } = require('../utils/hmac');

async function list(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, token, ip_whitelist, is_active, created_at, updated_at FROM provider_sources ORDER BY created_at DESC'
    );
    // Mask token: show only first 8 chars
    const data = rows.map(r => ({ ...r, token_masked: `${r.token.substring(0, 8)}...` }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, ip_whitelist, is_active = 1 } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const token = generateToken(32);
    const whitelist = Array.isArray(ip_whitelist) && ip_whitelist.length > 0 ? ip_whitelist : null;

    const [result] = await pool.query(
      'INSERT INTO provider_sources (name, token, ip_whitelist, is_active) VALUES (?, ?, ?, ?)',
      [name, token, whitelist ? JSON.stringify(whitelist) : null, is_active ? 1 : 0]
    );
    const [rows] = await pool.query('SELECT * FROM provider_sources WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: { ...rows[0], token } }); // expose full token once on creation
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, ip_whitelist, is_active } = req.body;

    const whitelist = Array.isArray(ip_whitelist) && ip_whitelist.length > 0 ? ip_whitelist : null;

    const [result] = await pool.query(
      'UPDATE provider_sources SET name=?, ip_whitelist=?, is_active=?, updated_at=NOW() WHERE id=?',
      [name, whitelist ? JSON.stringify(whitelist) : null, is_active ? 1 : 0, id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Provider not found' });

    const [rows] = await pool.query('SELECT * FROM provider_sources WHERE id = ?', [id]);
    res.json({ success: true, data: { ...rows[0], token_masked: `${rows[0].token.substring(0, 8)}...` } });
  } catch (err) {
    next(err);
  }
}

async function regenerateToken(req, res, next) {
  try {
    const { id } = req.params;
    const newToken = generateToken(32);
    const [result] = await pool.query(
      'UPDATE provider_sources SET token=?, updated_at=NOW() WHERE id=?',
      [newToken, id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Provider not found' });
    res.json({ success: true, token: newToken });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM provider_sources WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Provider not found' });
    res.json({ success: true, message: 'Provider deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, regenerateToken, remove };
