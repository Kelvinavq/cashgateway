const { pool } = require('../config/database');

async function list(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      domain_id,
      account_id,
      direction,
      delivery_status,
      coelsa_code,
      cuit,
      date_from,
      date_to,
      amount_min,
      amount_max,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (domain_id) { conditions.push('m.domain_id = ?'); params.push(domain_id); }
    if (account_id) { conditions.push('m.hgcash_account_id = ?'); params.push(account_id); }
    if (direction) { conditions.push('m.direction = ?'); params.push(direction); }
    if (coelsa_code) { conditions.push('m.coelsa_code LIKE ?'); params.push(`%${coelsa_code}%`); }
    if (cuit) { conditions.push('(m.from_cuit = ? OR m.to_cuit = ?)'); params.push(cuit, cuit); }
    if (date_from) { conditions.push('m.movement_date >= ?'); params.push(date_from); }
    if (date_to) { conditions.push('m.movement_date <= ?'); params.push(date_to); }
    if (amount_min) { conditions.push('m.amount >= ?'); params.push(amount_min); }
    if (amount_max) { conditions.push('m.amount <= ?'); params.push(amount_max); }
    // EXISTS subquery avoids GROUP BY and join duplication issues
    if (delivery_status) {
      conditions.push('EXISTS (SELECT 1 FROM webhook_deliveries _wd WHERE _wd.movement_id = m.id AND _wd.status = ?)');
      params.push(delivery_status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM movements m ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT m.id, m.hg_id, m.external_id, m.account_id, m.hgcash_account_id, m.domain_id,
        m.amount, m.currency, m.direction, m.status, m.type, m.movement_date, m.timezone,
        m.from_name, m.to_name, m.from_cbu, m.to_cbu, m.from_cuit, m.to_cuit,
        m.coelsa_code, m.received_from_provider_at, m.forwarded_to_domain_at,
        m.received_at, m.created_at, m.updated_at, m.raw_payload,
        d.name AS domain_name,
        a.name AS account_name,
        (SELECT wd2.status   FROM webhook_deliveries wd2 WHERE wd2.movement_id = m.id ORDER BY wd2.created_at DESC LIMIT 1) AS delivery_status,
        (SELECT wd2.attempts FROM webhook_deliveries wd2 WHERE wd2.movement_id = m.id ORDER BY wd2.created_at DESC LIMIT 1) AS delivery_attempts
       FROM movements m
       LEFT JOIN domains d ON m.domain_id = d.id
       LEFT JOIN hgcash_accounts a ON m.hgcash_account_id = a.id
       ${where}
       ORDER BY m.received_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT m.*,
        d.name AS domain_name, d.slug AS domain_slug,
        a.name AS account_name, a.account_id AS hg_account_id
       FROM movements m
       LEFT JOIN domains d ON m.domain_id = d.id
       LEFT JOIN hgcash_accounts a ON m.hgcash_account_id = a.id
       WHERE m.id = ?`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Movement not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function getDeliveries(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM webhook_deliveries WHERE movement_id = ? ORDER BY created_at DESC',
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, getDeliveries };
