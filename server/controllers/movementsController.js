const { pool } = require('../config/database');
const { createDelivery } = require('../services/movementService');
const { webhookQueue } = require('../queues/webhookQueue');
const socketService = require('../services/socketService');
const { invalidateStatsCache } = require('../services/statsService');
const logger = require('../utils/logger');

async function list(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      domain_id,
      account_id,
      hgcash_account_id,
      direction,
      delivery_status,
      resolution_status,
      resolution_method,
      coelsa_code,
      cuit,
      cbu,
      date_from,
      date_to,
      amount_min,
      amount_max,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (domain_id)          { conditions.push('m.domain_id = ?');                                 params.push(domain_id); }
    if (hgcash_account_id)  { conditions.push('m.hgcash_account_id = ?');                         params.push(hgcash_account_id); }
    if (account_id)         { conditions.push('m.account_id LIKE ?');                             params.push(`%${account_id}%`); }
    if (direction)          { conditions.push('m.direction = ?');                                  params.push(direction); }
    if (resolution_status)  { conditions.push('m.resolution_status = ?');                         params.push(resolution_status); }
    if (resolution_method)  { conditions.push('m.resolution_method = ?');                         params.push(resolution_method); }
    if (coelsa_code)        { conditions.push('m.coelsa_code LIKE ?');                            params.push(`%${coelsa_code}%`); }
    if (cuit)               { conditions.push('(m.from_cuit = ? OR m.to_cuit = ?)');              params.push(cuit, cuit); }
    if (cbu)                { conditions.push('(m.from_cbu = ? OR m.to_cbu = ?)');                params.push(cbu, cbu); }
    if (date_from)          { conditions.push('m.movement_date >= ?');                            params.push(date_from); }
    if (date_to)            { conditions.push('m.movement_date <= ?');                            params.push(date_to); }
    if (amount_min)         { conditions.push('m.amount >= ?');                                   params.push(amount_min); }
    if (amount_max)         { conditions.push('m.amount <= ?');                                   params.push(amount_max); }
    if (delivery_status) {
      conditions.push('EXISTS (SELECT 1 FROM webhook_deliveries _wd WHERE _wd.movement_id = m.id AND _wd.status = ?)');
      params.push(delivery_status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM movements m ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT m.id, m.provider_event_id, m.gateway_event_id, m.hg_id, m.external_id,
        m.account_id, m.hgcash_account_id, m.domain_id,
        m.amount, m.currency, m.direction, m.status, m.type, m.movement_date, m.timezone,
        m.from_name, m.to_name, m.from_cbu, m.to_cbu, m.from_cuit, m.to_cuit,
        m.coelsa_code, m.resolution_status, m.resolution_method, m.unresolved_reason,
        m.received_from_provider_at, m.forwarded_to_domain_at,
        m.received_at, m.created_at, m.updated_at, m.raw_payload,
        d.name  AS domain_name,
        a.name  AS account_name,
        a.account_id AS hg_account_id,
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

async function resolve(req, res, next) {
  try {
    const { id } = req.params;
    const { hgcash_account_id } = req.body;

    if (!hgcash_account_id) {
      return res.status(400).json({ success: false, message: 'hgcash_account_id is required' });
    }

    const [movements] = await pool.query(
      'SELECT * FROM movements WHERE id = ?',
      [id]
    );
    const movement = movements[0];
    if (!movement) {
      return res.status(404).json({ success: false, message: 'Movement not found' });
    }
    if (!['unresolved', 'manually_resolved'].includes(movement.resolution_status)) {
      return res.status(409).json({ success: false, message: `Movement is already ${movement.resolution_status}` });
    }

    const [accounts] = await pool.query(
      `SELECT a.*, d.id AS domain_id, d.name AS domain_name, d.destination_webhook_url, d.destination_token
       FROM hgcash_accounts a
       LEFT JOIN domains d ON a.domain_id = d.id
       WHERE a.id = ? AND a.is_active = 1 AND d.is_active = 1`,
      [hgcash_account_id]
    );
    const account = accounts[0];
    if (!account) {
      return res.status(404).json({ success: false, message: 'Active HG.Cash account not found' });
    }

    await pool.query(
      `UPDATE movements SET
        hgcash_account_id  = ?,
        domain_id          = ?,
        resolution_status  = 'manually_resolved',
        resolution_method  = 'manual',
        unresolved_reason  = NULL,
        updated_at         = NOW()
       WHERE id = ?`,
      [account.id, account.domain_id, id]
    );

    const deliveryId = await createDelivery(id, account.domain_id, account.destination_webhook_url);

    await webhookQueue.add(
      'forward',
      { deliveryId, movementId: parseInt(id) },
      { attempts: 5, backoff: { type: 'exponential', delay: 5000 } }
    );

    const [updatedRows] = await pool.query(
      `SELECT m.*, d.name AS domain_name, a.name AS account_name
       FROM movements m
       LEFT JOIN domains d ON m.domain_id = d.id
       LEFT JOIN hgcash_accounts a ON m.hgcash_account_id = a.id
       WHERE m.id = ?`,
      [id]
    );

    socketService.emit('movement:resolved', updatedRows[0]);
    await invalidateStatsCache();

    logger.info(`Movement ${id} manually resolved → account ${account.id}, domain ${account.domain_id}`);
    res.json({ success: true, data: updatedRows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, getDeliveries, resolve };
