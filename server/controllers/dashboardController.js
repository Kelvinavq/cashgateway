const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

const STATS_CACHE_TTL = 30;

async function getStats(req, res, next) {
  try {
    const cacheKey = 'dashboard:stats';
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: JSON.parse(cached), cached: true });
      }
    } catch (e) {
      logger.warn('Redis cache miss (error):', e.message);
    }

    const [[movStats]] = await pool.query(`
      SELECT
        COUNT(*) AS total_movements,
        SUM(CASE WHEN direction = 'Inbound'  THEN 1 ELSE 0 END) AS inbound_count,
        SUM(CASE WHEN direction = 'Outbound' THEN 1 ELSE 0 END) AS outbound_count,
        SUM(CASE WHEN direction = 'Inbound' AND currency = 'ARS' THEN amount ELSE 0 END) AS total_ars_received,
        SUM(CASE WHEN resolution_status = 'resolved'           THEN 1 ELSE 0 END) AS resolved_count,
        SUM(CASE WHEN resolution_status = 'unresolved'         THEN 1 ELSE 0 END) AS unresolved_count,
        SUM(CASE WHEN resolution_status = 'manually_resolved'  THEN 1 ELSE 0 END) AS manually_resolved_count
      FROM movements
    `);

    const [[delStats]] = await pool.query(`
      SELECT
        SUM(CASE WHEN status = 'success'                    THEN 1 ELSE 0 END) AS delivered_ok,
        SUM(CASE WHEN status = 'failed'                     THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status IN ('pending','processing')    THEN 1 ELSE 0 END) AS pending
      FROM webhook_deliveries
    `);

    const [recentMovements] = await pool.query(`
      SELECT m.id, m.hg_id, m.amount, m.currency, m.direction, m.status,
        m.from_name, m.to_name, m.coelsa_code, m.received_at,
        m.resolution_status,
        d.name AS domain_name,
        (SELECT wd.status FROM webhook_deliveries wd WHERE wd.movement_id = m.id ORDER BY wd.created_at DESC LIMIT 1) AS delivery_status
      FROM movements m
      LEFT JOIN domains d ON m.domain_id = d.id
      ORDER BY m.received_at DESC LIMIT 10
    `);

    const [recentFailed] = await pool.query(`
      SELECT wd.*, m.hg_id, m.amount, m.currency, d.name AS domain_name
      FROM webhook_deliveries wd
      LEFT JOIN movements m ON wd.movement_id = m.id
      LEFT JOIN domains d ON wd.domain_id = d.id
      WHERE wd.status = 'failed'
      ORDER BY wd.updated_at DESC LIMIT 5
    `);

    const stats = {
      movements: {
        total:              parseInt(movStats.total_movements)         || 0,
        inbound:            parseInt(movStats.inbound_count)           || 0,
        outbound:           parseInt(movStats.outbound_count)          || 0,
        total_ars_received: parseFloat(movStats.total_ars_received)    || 0,
        resolved:           parseInt(movStats.resolved_count)          || 0,
        unresolved:         parseInt(movStats.unresolved_count)        || 0,
        manually_resolved:  parseInt(movStats.manually_resolved_count) || 0,
      },
      deliveries: {
        success: parseInt(delStats.delivered_ok) || 0,
        failed:  parseInt(delStats.failed)       || 0,
        pending: parseInt(delStats.pending)      || 0,
      },
      recent_movements:          recentMovements,
      recent_failed_deliveries:  recentFailed,
    };

    try {
      await redisClient.setEx(cacheKey, STATS_CACHE_TTL, JSON.stringify(stats));
    } catch (e) {
      logger.warn('Redis set error:', e.message);
    }

    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats };
