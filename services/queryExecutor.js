const { runSelect } = require('../db/database');
const { validateForGeneration } = require('./sqlSafety');

function executeValidatedSelect(sql) {
  const safety = validateForGeneration(sql);
  if (!safety.isSafe) {
    const err = new Error(safety.reason);
    err.statusCode = 403;
    throw err;
  }

  const maxRows = parseInt(process.env.MAX_ROWS_RETURNED || '200', 10);
  let finalSql = sql.trim().replace(/;\s*$/, '');
  if (!/\blimit\s+\d+/i.test(finalSql)) {
    finalSql += ` LIMIT ${maxRows}`;
  }

  const start = Date.now();
  const { columns, rows } = runSelect(finalSql);
  const executionTimeMs = Date.now() - start;

  return { columns, rows, rowCount: rows.length, executionTimeMs };
}

module.exports = { executeValidatedSelect };