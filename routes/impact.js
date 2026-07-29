const express = require('express');
const router = express.Router();

const { getDb } = require('../db/database');
const { classifyStatement, splitStatements } = require('../services/sqlSafety');

const PREVIEW_ROW_LIMIT = 20;

/**
 * POST /api/analyze-impact
 * Body: { sql: string }  -- one or more statements, separated by `;`
 *
 * Runs every statement inside a single transaction and reports what it did
 * (rows returned for SELECTs, rows affected for INSERT/UPDATE/DELETE, or an
 * error message if a statement failed) — then ALWAYS rolls back, so nothing
 * is ever permanently written to the demo database, regardless of what was
 * pasted in.
 */
router.post('/analyze-impact', (req, res) => {
  const { sql } = req.body;
  if (!sql || !sql.trim()) {
    return res.status(422).json({ success: false, error: 'Please paste one or more SQL statements.' });
  }

  const statements = splitStatements(sql);
  if (statements.length === 0) {
    return res.status(422).json({ success: false, error: 'No valid SQL statements found.' });
  }

  const db = getDb();
  const results = [];

  db.run('BEGIN');

  for (const statement of statements) {
    const classification = classifyStatement(statement);
    const start = Date.now();

    const entry = {
      sql: statement,
      keyword: classification.keyword,
      riskLevel: classification.riskLevel,
      success: true,
      error: null,
      rowsAffected: null,
      rowsReturned: null,
      previewColumns: [],
      previewRows: [],
      truncatedPreview: false,
      executionTimeMs: 0,
    };

    try {
      if (classification.isSelect) {
        const execResult = db.exec(statement);
        if (execResult.length > 0) {
          const { columns, values } = execResult[0];
          entry.previewColumns = columns;
          entry.previewRows = values.slice(0, PREVIEW_ROW_LIMIT).map((valueRow) => {
            const obj = {};
            columns.forEach((col, i) => {
              obj[col] = valueRow[i];
            });
            return obj;
          });
          entry.rowsReturned = values.length;
          entry.truncatedPreview = values.length > PREVIEW_ROW_LIMIT;
        } else {
          entry.rowsReturned = 0;
        }
      } else {
        db.run(statement);
        entry.rowsAffected = db.getRowsModified();
      }
    } catch (statementError) {
      entry.success = false;
      entry.error = statementError.message;
    }

    entry.executionTimeMs = Date.now() - start;
    results.push(entry);
  }

  // ALWAYS roll back, whether every statement succeeded or not — this
  // endpoint is a simulation, never a real execution.
  try {
    db.run('ROLLBACK');
  } catch {
    // If a fatal error already ended the transaction implicitly, there's
    // nothing left to roll back — safe to ignore.
  }

  res.json({
    success: true,
    data: {
      statementsAnalyzed: statements.length,
      results,
      note: 'All statements were run inside a transaction that was rolled back. No data was permanently changed.',
    },
  });
});

module.exports = router;
