const { getDb, runSelect } = require('../db/database');
const { classifyStatement } = require('./sqlSafety');

function previewExecute(rawSql) {
  const sql = (rawSql || '').trim().replace(/;\s*$/, '');

  if (!sql) {
    return { success: false, error: 'No SQL provided.' };
  }
  if (sql.includes(';')) {
    return {
      success: false,
      error: 'Please run one statement at a time here — for multiple statements, use the Impact Analyzer page.',
    };
  }

  const classification = classifyStatement(sql);
  const db = getDb();
  const start = Date.now();

  if (classification.isSelect) {
    try {
      const maxRows = parseInt(process.env.MAX_ROWS_RETURNED || '200', 10);
      let finalSql = sql;
      if (!/\blimit\s+\d+/i.test(finalSql)) {
        finalSql += ` LIMIT ${maxRows}`;
      }
      const { columns, rows } = runSelect(finalSql);
      return {
        success: true,
        keyword: classification.keyword,
        riskLevel: classification.riskLevel,
        wasRolledBack: false,
        columns,
        rows,
        rowCount: rows.length,
        rowsAffected: null,
        executionTimeMs: Date.now() - start,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  db.run('BEGIN');
  let rowsAffected = null;
  let executionError = null;
  try {
    db.run(sql);
    rowsAffected = db.getRowsModified();
  } catch (err) {
    executionError = err.message;
  } finally {
    try {
      db.run('ROLLBACK');
    } catch {
      // Nothing to roll back if the transaction already ended.
    }
  }

  if (executionError) {
    return { success: false, error: executionError };
  }

  return {
    success: true,
    keyword: classification.keyword,
    riskLevel: classification.riskLevel,
    wasRolledBack: true,
    columns: [],
    rows: [],
    rowCount: 0,
    rowsAffected,
    executionTimeMs: Date.now() - start,
  };
}

module.exports = { previewExecute };