const { pool } = require('../config/database');
const { webhookQueue } = require('../queues/webhookQueue');
const { hasColumn } = require('../services/schemaService');
const logService = require('../services/logService');

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    if (status) { conditions.push('wd.status = ?'); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const hasProviderStatus = await hasColumn('movements', 'provider_status');
    const hasDeliveryKind = await hasColumn('webhook_deliveries', 'delivery_kind');
    const hasInitialDeliveredAt = await hasColumn('webhook_deliveries', 'initial_delivered_at');
    const hasLastUpdateDeliveredAt = await hasColumn('webhook_deliveries', 'last_update_delivered_at');
    const hasDomainHostname = await hasColumn('domains', 'hostname');
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM webhook_deliveries wd ${where}`,
      params
    );
    const [rows] = await pool.query(`
      SELECT wd.*, m.hg_id, m.amount, m.currency, m.direction, m.coelsa_code,
        m.gateway_event_id,
        ${hasProviderStatus ? 'm.provider_status AS provider_status,' : 'NULL AS provider_status,'}
        ${hasDeliveryKind ? 'wd.delivery_kind AS delivery_kind,' : "'initial' AS delivery_kind,"}
        ${hasInitialDeliveredAt ? 'wd.initial_delivered_at AS initial_delivered_at,' : 'NULL AS initial_delivered_at,'}
        ${hasLastUpdateDeliveredAt ? 'wd.last_update_delivered_at AS last_update_delivered_at,' : 'NULL AS last_update_delivered_at,'}
        d.name AS domain_name,
        ${hasDomainHostname ? 'd.hostname AS domain_hostname' : 'NULL AS domain_hostname'}
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
    const hasDeliveryKind = await hasColumn('webhook_deliveries', 'delivery_kind');
    await pool.query(
      `UPDATE webhook_deliveries
          SET status='pending',
              next_retry_at=NULL,
              ${hasDeliveryKind ? "delivery_kind='manual_retry'," : ''}
              updated_at=NOW()
        WHERE id=?`,
      [id]
    );
    await webhookQueue.add('forward', { deliveryId: id, movementId: delivery.movement_id, deliveryKind: 'manual_retry' }, {
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

    const hasDeliveryKind = await hasColumn('webhook_deliveries', 'delivery_kind');
    await pool.query(
      `UPDATE webhook_deliveries
       SET status='pending', attempts=0, dead_at=NULL, next_retry_at=NULL,
           last_error=NULL, ${hasDeliveryKind ? "delivery_kind='manual_retry'," : ''} updated_at=NOW()
       WHERE id=?`,
      [id]
    );

    await webhookQueue.add('forward', { deliveryId: id, movementId: delivery.movement_id, deliveryKind: 'manual_retry' }, {
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
