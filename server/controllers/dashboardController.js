const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const { hasColumn } = require('../services/schemaService');
const logger = require('../utils/logger');

const STATS_CACHE_TTL = 30;

async function getStats(req, res, next) {
  try {
    const cacheKey = 'dashboard:stats';
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json({ success: true, data: JSON.parse(cached), cached: true });
    } catch (e) {
      logger.warn('Redis cache miss (error):', e.message);
    }

    const hasDestinationDomainRaw = await hasColumn('movements', 'destination_domain_raw');
    const hasDestinationDomainsRaw = await hasColumn('movements', 'destination_domains_raw');
    const hasDomainHostname = await hasColumn('domains', 'hostname');

    const movementsSelectParts = [
      'COUNT(*) AS total_movements',
      "SUM(CASE WHEN direction = 'Inbound'  THEN 1 ELSE 0 END) AS inbound_count",
      "SUM(CASE WHEN direction = 'Outbound' THEN 1 ELSE 0 END) AS outbound_count",
      "SUM(CASE WHEN direction = 'Inbound' AND currency = 'ARS' THEN amount ELSE 0 END) AS total_ars_received",
      "SUM(CASE WHEN resolution_status = 'resolved'           THEN 1 ELSE 0 END) AS resolved_count",
      "SUM(CASE WHEN resolution_status = 'unresolved'         THEN 1 ELSE 0 END) AS unresolved_count",
      "SUM(CASE WHEN resolution_status = 'manually_resolved'  THEN 1 ELSE 0 END) AS manually_resolved_count",
      "SUM(CASE WHEN resolution_method IN ('destination_domain', 'destination_domains') THEN 1 ELSE 0 END) AS destination_domain_resolved_count",
      "SUM(CASE WHEN resolution_status = 'multi_resolved' THEN 1 ELSE 0 END) AS multi_destination_count",
      "SUM(CASE WHEN resolution_status = 'unresolved' AND unresolved_reason LIKE 'Invalid destination domain%' THEN 1 ELSE 0 END) AS unresolved_invalid_domain_count",
    ];

    const movementRawSelectParts = [
      'm.id',
      'm.hg_id',
      'm.amount',
      'm.currency',
      'm.direction',
      'm.status',
      'm.from_name',
      'm.to_name',
      'm.coelsa_code',
      'm.received_at',
      'm.resolution_status',
      'm.resolution_method',
    ];

    if (hasDestinationDomainRaw) {
      movementRawSelectParts.push('m.destination_domain_raw');
    }
    if (hasDestinationDomainsRaw) {
      movementRawSelectParts.push('m.destination_domains_raw');
    }

    movementRawSelectParts.push(
      'd.name AS domain_name',
      hasDomainHostname ? 'd.hostname AS domain_hostname' : 'NULL AS domain_hostname',
      '(SELECT COUNT(*) FROM webhook_deliveries wd WHERE wd.movement_id = m.id) AS delivery_count',
      '(SELECT wd.status FROM webhook_deliveries wd WHERE wd.movement_id = m.id ORDER BY wd.created_at DESC LIMIT 1) AS delivery_status'
    );

    const [[movStats]] = await pool.query(`
      SELECT ${movementsSelectParts.join(', ')}
      FROM movements
    `);

    const [[delStats]] = await pool.query(`
      SELECT
        SUM(CASE WHEN status = 'success'                  THEN 1 ELSE 0 END) AS delivered_ok,
        SUM(CASE WHEN status = 'failed'                   THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status IN ('pending','processing')  THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'dead'                     THEN 1 ELSE 0 END) AS dead,
        SUM(CASE WHEN ack_valid = 1                       THEN 1 ELSE 0 END) AS ack_valid_count,
        SUM(CASE WHEN ack_received = 1 AND ack_valid = 0  THEN 1 ELSE 0 END) AS ack_invalid_count
      FROM webhook_deliveries
    `);

    const [[provStats]] = await pool.query(`
      SELECT COUNT(*) AS active_providers FROM provider_sources WHERE is_active = 1
    `);

    const [[logStats]] = await pool.query(`
      SELECT
        SUM(CASE WHEN event_type = 'rate_limit_ip' OR event_type = 'rate_limit_provider' THEN 1 ELSE 0 END) AS rate_limit_hits,
        SUM(CASE WHEN event_type = 'delivery_dead'        THEN 1 ELSE 0 END) AS dead_deliveries_total,
        SUM(CASE WHEN event_type = 'delivery_reactivated' THEN 1 ELSE 0 END) AS reactivated_total,
        SUM(CASE WHEN event_type = 'webhook_processing_error' THEN 1 ELSE 0 END) AS webhook_errors,
        SUM(CASE WHEN event_type = 'invalid_destination_domain' THEN 1 ELSE 0 END) AS invalid_destination_domains,
        SUM(CASE WHEN event_type = 'destination_domain_not_found' THEN 1 ELSE 0 END) AS destination_domain_not_found,
        SUM(CASE WHEN event_type = 'destination_domains_partial_match' THEN 1 ELSE 0 END) AS destination_domains_partial_match,
        SUM(CASE WHEN event_type = 'multi_destination_resolved' THEN 1 ELSE 0 END) AS multi_destination_resolved
      FROM system_logs
    `);

    const [[multiDeliveryStats]] = await pool.query(`
      SELECT COUNT(*) AS multi_destination_deliveries
      FROM webhook_deliveries wd
      INNER JOIN movements m ON wd.movement_id = m.id
      WHERE m.resolution_method = 'destination_domains'
    `);

    const [recentMovements] = await pool.query(`
      SELECT ${movementRawSelectParts.join(', ')}
      FROM movements m
      LEFT JOIN domains d ON m.domain_id = d.id
      ORDER BY m.received_at DESC LIMIT 10
    `);

    const [recentFailed] = await pool.query(`
      SELECT wd.*, m.hg_id, m.amount, m.currency, d.name AS domain_name
      FROM webhook_deliveries wd
      LEFT JOIN movements m ON wd.movement_id = m.id
      LEFT JOIN domains d ON wd.domain_id = d.id
      WHERE wd.status IN ('failed','dead')
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
        destination_domain_resolved: parseInt(movStats.destination_domain_resolved_count) || 0,
        multi_destination:  parseInt(movStats.multi_destination_count) || 0,
        unresolved_invalid_domain: parseInt(movStats.unresolved_invalid_domain_count) || 0,
      },
      deliveries: {
        success:          parseInt(delStats.delivered_ok)     || 0,
        failed:           parseInt(delStats.failed)           || 0,
        pending:          parseInt(delStats.pending)          || 0,
        dead:             parseInt(delStats.dead)             || 0,
        ack_valid:        parseInt(delStats.ack_valid_count)  || 0,
        ack_invalid:      parseInt(delStats.ack_invalid_count)|| 0,
        multi_destination: parseInt(multiDeliveryStats.multi_destination_deliveries) || 0,
      },
      providers: {
        active: parseInt(provStats.active_providers) || 0,
      },
      security: {
        rate_limit_hits:     parseInt(logStats.rate_limit_hits)     || 0,
        dead_deliveries:     parseInt(logStats.dead_deliveries_total)|| 0,
        reactivated:         parseInt(logStats.reactivated_total)   || 0,
        webhook_errors:      parseInt(logStats.webhook_errors)      || 0,
        invalid_destination_domains: parseInt(logStats.invalid_destination_domains) || 0,
        destination_domain_not_found: parseInt(logStats.destination_domain_not_found) || 0,
        destination_domains_partial_match: parseInt(logStats.destination_domains_partial_match) || 0,
        multi_destination_resolved: parseInt(logStats.multi_destination_resolved) || 0,
      },
      recent_movements:         recentMovements,
      recent_failed_deliveries: recentFailed,
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
