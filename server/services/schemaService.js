const { pool } = require('../config/database');

const tableColumnsCache = new Map();

async function getTableColumns(tableName) {
  if (tableColumnsCache.has(tableName)) {
    return tableColumnsCache.get(tableName);
  }

  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?`,
    [tableName]
  );

  const columns = new Set(rows.map(row => row.COLUMN_NAME));
  tableColumnsCache.set(tableName, columns);
  return columns;
}

async function hasColumn(tableName, columnName) {
  const columns = await getTableColumns(tableName);
  return columns.has(columnName);
}

module.exports = {
  getTableColumns,
  hasColumn,
};
