const express = require('express');
const router = express.Router();

const { generateSql } = require('../services/aiService');
const { validateForGeneration } = require('../services/sqlSafety');
const { runSelect } = require('../db/database');

/**
 * POST /api/generate-sql
 * Body: { prompt: string }
 * Turns a plain-English question into SQL, validates it's a safe SELECT,
 * and estimates its row count.
 */
router.post('/generate-sql', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || prompt.trim().length < 3) {
      return res.status(422).json({ success: false, error: 'Please enter a more detailed question.' });
    }

    const result = await generateSql(prompt.trim());
    const safety = validateForGeneration(result.sql);

    let rowEstimate = null;
    if (safety.isSafe) {
      try {
        const countSql = `SELECT COUNT(*) as total FROM (${result.sql.replace(/;\s*$/, '')}) AS estimate_subquery`;
        const { rows } = runSelect(countSql);
        rowEstimate = rows[0] ? rows[0].total : null;
      } catch {
        rowEstimate = null; // Non-fatal — the user can still see/edit the SQL.
      }
    }

    res.json({ success: true, data: { ...result, safety, rowEstimate } });
  } catch (err) {
    console.error('generate-sql error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to generate SQL.' });
  }
});

/**
 * POST /api/run-select
 * Body: { sql: string }
 * Executes a single, validated, read-only SELECT and returns results.
 * Re-validates independently of whatever the client claims, since the SQL
 * may have been hand-edited in the browser.
 */
router.post('/run-select', (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) {
      return res.status(422).json({ success: false, error: 'No SQL provided.' });
    }

    const safety = validateForGeneration(sql);
    if (!safety.isSafe) {
      return res.status(403).json({ success: false, error: safety.reason });
    }

    const maxRows = parseInt(process.env.MAX_ROWS_RETURNED || '200', 10);
    let finalSql = sql.trim().replace(/;\s*$/, '');
    if (!/\blimit\s+\d+/i.test(finalSql)) {
      finalSql += ` LIMIT ${maxRows}`;
    }

    const start = Date.now();
    const { columns, rows } = runSelect(finalSql);
    const executionTimeMs = Date.now() - start;

    res.json({ success: true, data: { columns, rows, rowCount: rows.length, executionTimeMs } });
  } catch (err) {
    res.status(400).json({ success: false, error: `Query execution failed: ${err.message}` });
  }
});

module.exports = router;
