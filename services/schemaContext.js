const { tables } = require('../db/schemaDefinition');

/**
 * Builds a compact, plain-text schema description for the AI prompt.
 *
 * Deliberately simple: this reads ONLY from schemaDefinition.js (a plain
 * JS object already in memory) and does not query the database at all.
 * That keeps this fast, predictable, and small every single time — no
 * risk of it silently growing based on how much data happens to be in the
 * database right now.
 */
function buildSchemaContext() {
  const lines = [];

  for (const [tableName, tableDef] of Object.entries(tables)) {
    const columnList = Object.entries(tableDef.columns)
      .map(([col, type]) => (col === tableDef.primaryKey ? `${col}(PK)` : col))
      .join(', ');

    lines.push(`${tableName}: ${columnList}`);

    if (tableDef.knownValues) {
      for (const [column, values] of Object.entries(tableDef.knownValues)) {
        lines.push(`  ${tableName}.${column} real values: ${values.join(', ')}`);
      }
    }
  }

  return lines.join('\n');
}

module.exports = { buildSchemaContext };