const initSqlJs = require('sql.js');
const { tables } = require('./schemaDefinition');
const seedData = require('./seedData');

let db = null;

/**
 * Builds a CREATE TABLE statement from a schemaDefinition.js table entry.
 */
function buildCreateTableSQL(tableName, tableDef) {
  const columnDefs = Object.entries(tableDef.columns).map(([column, type]) => {
    if (column === tableDef.primaryKey) {
      return type === 'INTEGER'
        ? `${column} INTEGER PRIMARY KEY AUTOINCREMENT`
        : `${column} ${type} PRIMARY KEY`;
    }
    return `${column} ${type}`;
  });

  return `CREATE TABLE ${tableName} (\n  ${columnDefs.join(',\n  ')}\n);`;
}

/**
 * Inserts every row for one table using a parameterized INSERT (avoids any
 * manual string escaping).
 */
function seedTable(tableName, tableDef, rows) {
  if (!rows || rows.length === 0) return;

  const columns = Object.keys(tableDef.columns);
  const placeholders = columns.map(() => '?').join(', ');
  const insertSQL = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

  for (const row of rows) {
    const values = columns.map((col) => (row[col] !== undefined ? row[col] : null));
    db.run(insertSQL, values);
  }
}

/**
 * Builds the in-memory database from scratch: creates every table defined
 * in schemaDefinition.js, then loads every matching array from seedData.js.
 * Called once when the server starts.
 */
async function initDatabase() {
  const SQL = await initSqlJs();
  db = new SQL.Database();

  for (const [tableName, tableDef] of Object.entries(tables)) {
    db.run(buildCreateTableSQL(tableName, tableDef));
  }

  for (const [tableName, tableDef] of Object.entries(tables)) {
    seedTable(tableName, tableDef, seedData[tableName]);
  }

  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database has not been initialized yet. Call initDatabase() first.');
  }
  return db;
}

/**
 * Runs a read-only query and returns { columns, rows } with rows as plain
 * objects (easier for the frontend to render than sql.js's raw array form).
 */
function runSelect(sql) {
  const result = db.exec(sql);
  if (result.length === 0) {
    return { columns: [], rows: [] };
  }

  const { columns, values } = result[0];
  const rows = values.map((valueRow) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = valueRow[i];
    });
    return obj;
  });

  return { columns, rows };
}

module.exports = { initDatabase, getDb, runSelect };
