const { pool } = require('../config/database');
const { webhookQueue } = require('../queues/webhookQueue');
const logService = require('../services/logService');

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    if (status) { conditions.push('wd.status = ?'); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM webhook_deliveries wd ${where}`,
      params
    );
    const [rows] = await pool.query(`
      SELECT wd.*, m.hg_id, m.amount, m.currency, m.direction, m.coelsa_code,
        m.gateway_event_id, d.name AS domain_name
      FROM webhook_deliveries wd
      LEFT JOIN movements m ON wd.movement_id = m.id
      LEFT JOIN domains d ON wd.domain_id = d.id
      ${where}
      ORDER BY wd.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    res.json({
      success: true,
      data: rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
}

async function retry(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM webhook_deliveries WHERE id = ?', [id]);
    const delivery = rows[0];
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });
    if (delivery.status === 'success') {
      return res.status(400).json({ success: false, message: 'Delivery already succeeded' });
    }
    if (delivery.status === 'dead') {
      return res.status(400).json({ success: false, message: 'Use /reactivate for dead deliveries' });
    }
    await pool.query(
      "UPDATE webhook_deliveries SET status='pending', next_retry_at=NULL, updated_at=NOW() WHERE id=?",
      [id]
    );
    await webhookQueue.add('forward', { deliveryId: id, movementId: delivery.movement_id }, {
      attempts: 5, backoff: { type: 'exponential', delay: 5000 },
    });
    res.json({ success: true, message: 'Retry queued' });
  } catch (err) {
    next(err);
  }
}

async function reactivate(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM webhook_deliveries WHERE id = ?', [id]);
    const delivery = rows[0];
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });
    if (delivery.status !== 'dead') {
      return res.status(400).json({ success: false, message: 'Only dead deliveries can be reactivated' });
    }

    await pool.query(
      `UPDATE webhook_deliveries
       SET status='pending', attempts=0, dead_at=NULL, next_retry_at=NULL,
           last_error=NULL, updated_at=NOW()
       WHERE id=?`,
      [id]
    );

    await webhookQueue.add('forward', { deliveryId: id, movementId: delivery.movement_id }, {
      attempts: 5, backoff: { type: 'exponential', delay: 5000 },
    });

    logService.info({
      source: 'deliveriesController',
      event_type: 'delivery_reactivated',
      delivery_id: parseInt(id),
      message: `Dead delivery ${id} reactivated manually`,
      metadata: { movement_id: delivery.movement_id },
    });

    res.json({ success: true, message: 'Delivery reactivated and queued' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, retry, reactivate };
