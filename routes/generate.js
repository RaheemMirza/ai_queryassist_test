const express = require('express');
const router = express.Router();

const { handleUserMessage } = require('../services/aiService');
const { validateForGeneration } = require('../services/sqlSafety');
const { runSelect } = require('../db/database');
const { executeValidatedSelect } = require('../services/queryExecutor');

router.post('/generate-sql', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || prompt.trim().length < 1) {
      return res.status(422).json({ success: false, error: 'Please enter a message.' });
    }

    const result = await handleUserMessage(prompt.trim());

    if (result.type === 'chat') {
      return res.json({ success: true, data: { type: 'chat', reply: result.reply } });
    }

    const safety = validateForGeneration(result.sql);

    let rowEstimate = null;
    let results = null;

    if (safety.isSafe) {
      try {
        const countSql = `SELECT COUNT(*) as total FROM (${result.sql.replace(/;\s*$/, '')}) AS estimate_subquery`;
        const { rows } = runSelect(countSql);
        rowEstimate = rows[0] ? rows[0].total : null;
      } catch {
        rowEstimate = null;
      }

      try {
        results = executeValidatedSelect(result.sql);
      } catch {
        results = null;
      }
    }

    res.json({ success: true, data: { ...result, safety, rowEstimate, results } });
  } catch (err) {
    console.error('generate-sql error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to generate a response.' });
  }
});

router.post('/run-select', (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) {
      return res.status(422).json({ success: false, error: 'No SQL provided.' });
    }

    const result = executeValidatedSelect(sql);
    res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

module.exports = router;