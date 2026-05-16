const { pool } = require('../config/database');

async function list(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, slug, base_url, destination_webhook_url, destination_token, is_active, created_at, updated_at FROM domains ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, slug, base_url, destination_webhook_url, destination_token, is_active = 1 } = req.body;
    const [result] = await pool.query(
      'INSERT INTO domains (name, slug, base_url, destination_webhook_url, destination_token, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [name, slug, base_url, destination_webhook_url, destination_token || null, is_active ? 1 : 0]
    );
    const [rows] = await pool.query('SELECT * FROM domains WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
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
    const { name, slug, base_url, destination_webhook_url, destination_token, is_active } = req.body;
    const [result] = await pool.query(
      'UPDATE domains SET name=?, slug=?, base_url=?, destination_webhook_url=?, destination_token=?, is_active=?, updated_at=NOW() WHERE id=?',
      [name, slug, base_url, destination_webhook_url, destination_token || null, is_active ? 1 : 0, id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Domain not found' });
    const [rows] = await pool.query('SELECT * FROM domains WHERE id = ?', [id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Slug already exists' });
    }
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

module.exports = { list, create, update, remove };
