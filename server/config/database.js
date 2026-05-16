const mysql = require('mysql2/promise');
const env = require('./env');
const logger = require('../utils/logger');

const pool = mysql.createPool(env.mysql);

pool.on('connection', () => {
  logger.info('New MySQL connection established');
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    logger.info('MySQL connected successfully');
    conn.release();
  } catch (err) {
    logger.error('MySQL connection failed:', err.message);
    throw err;
  }
}

module.exports = { pool, testConnection };
