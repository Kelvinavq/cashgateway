const { pool } = require('../config/database');

/**
 * Persist a structured log entry to system_logs.
 * Fire-and-forget — never throws, uses console.error as fallback.
 *
 * @param {object} entry
 * @param {'info'|'warn'|'error'|'debug'} entry.level
 * @param {string}  entry.source
 * @param {string}  entry.event_type
 * @param {string}  [entry.request_id]
 * @param {string}  [entry.gateway_event_id]
 * @param {number}  [entry.provider_source_id]
 * @param {number}  [entry.movement_id]
 * @param {number}  [entry.delivery_id]
 * @param {string}  entry.message
 * @param {object}  [entry.metadata]
 * @param {string}  [entry.ip_address]
 */
async function log(entry) {
  try {
    const {
      level = 'info',
      source = null,
      event_type = null,
      request_id = null,
      gateway_event_id = null,
      provider_source_id = null,
      movement_id = null,
      delivery_id = null,
      message,
      metadata = null,
      ip_address = null,
    } = entry;

    await pool.query(
      `INSERT INTO system_logs
        (level, source, event_type, request_id, gateway_event_id,
         provider_source_id, movement_id, delivery_id,
         message, metadata, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        level, source, event_type, request_id, gateway_event_id,
        provider_source_id || null, movement_id || null, delivery_id || null,
        message,
        metadata ? JSON.stringify(metadata) : null,
        ip_address,
      ]
    );
  } catch (err) {
    // Never block the main flow on log failures
    console.error('[logService] Failed to write system log:', err.message);
  }
}

// Convenience wrappers
const logService = {
  info:  (entry) => log({ level: 'info',  ...entry }),
  warn:  (entry) => log({ level: 'warn',  ...entry }),
  error: (entry) => log({ level: 'error', ...entry }),
  debug: (entry) => log({ level: 'debug', ...entry }),
};

module.exports = logService;
