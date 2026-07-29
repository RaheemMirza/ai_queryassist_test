const { tables } = require('../db/schemaDefinition');

/**
 * Builds a plain-text schema description for the AI prompt, generated
 * directly from schemaDefinition.js so it can never drift out of sync
 * with the actual database structure.
 */
function buildSchemaContext() {
  const lines = [];

  for (const [tableName, tableDef] of Object.entries(tables)) {
    lines.push(`Table: ${tableName}`);
    lines.push(`  Description: ${tableDef.description}`);
    for (const [column, type] of Object.entries(tableDef.columns)) {
      const pkLabel = column === tableDef.primaryKey ? ' (PRIMARY KEY)' : '';
      lines.push(`  - ${column} ${type}${pkLabel}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

module.exports = { buildSchemaContext };
