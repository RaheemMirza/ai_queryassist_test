const express = require('express');
const router = express.Router();

const { handleUserMessage } = require('../services/aiService');
const { classifyStatement } = require('../services/sqlSafety');
const { runSelect } = require('../db/database');
const { previewExecute } = require('../services/queryExecutor');
const appStore = require('../db/appStore');

function truncate(text, maxChars) {
  if (!text) return '';
  return text.length > maxChars ? text.slice(0, maxChars) + '… (truncated)' : text;
}

/**
 * POST /api/generate-sql
 * Body: { prompt: string, conversationId: string }
 *
 * Each message is sent to the AI on its own, with no conversation history
 * attached -- this keeps every request small and predictable in size.
 * Everything is still recorded to the persistent history store so the
 * History and Saved Queries pages keep working normally.
 */
router.post('/generate-sql', async (req, res) => {
  try {
    const { prompt, conversationId } = req.body;
    if (!prompt || prompt.trim().length < 1) {
      return res.status(422).json({ success: false, error: 'Please enter a message.' });
    }
    if (!conversationId) {
      return res.status(422).json({ success: false, error: 'Missing conversationId.' });
    }

    appStore.addMessage(conversationId, { role: 'user', content: truncate(prompt.trim(), 1000) });

    const result = await handleUserMessage(prompt.trim());

    if (result.type === 'chat') {
      appStore.addMessage(conversationId, { role: 'assistant', type: 'chat', reply: truncate(result.reply, 500) });
      return res.json({ success: true, data: { type: 'chat', reply: result.reply } });
    }

    // type === 'sql'
    const classification = classifyStatement(result.sql);

    let rowEstimate = null;
    if (classification.isSelect) {
      try {
        const countSql = `SELECT COUNT(*) as total FROM (${result.sql.replace(/;\s*$/, '')}) AS estimate_subquery`;
        const { rows } = runSelect(countSql);
        rowEstimate = rows[0] ? rows[0].total : null;
      } catch {
        rowEstimate = null;
      }
    }

    const execution = previewExecute(result.sql);

    appStore.addMessage(conversationId, {
      role: 'assistant',
      type: 'sql',
      reply: truncate(result.reply, 400),
      sql: truncate(result.sql, 1000),
      explanation: truncate(result.explanation, 800),
      confidenceScore: result.confidenceScore,
      tablesInvolved: result.tablesInvolved,
      keyword: classification.keyword,
      riskLevel: classification.riskLevel,
      rowCount: execution.success ? execution.rowCount : null,
      rowsAffected: execution.success ? execution.rowsAffected : null,
    });

    res.json({ success: true, data: { ...result, rowEstimate, execution } });
  } catch (err) {
    console.error('generate-sql error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to generate a response.' });
  }
});

/**
 * POST /api/run-query
 * Body: { sql: string }
 * Re-runs a statement (e.g. after hand-editing it in the browser).
 */
router.post('/run-query', (req, res) => {
  const { sql } = req.body;
  const execution = previewExecute(sql);
  if (!execution.success) {
    return res.status(400).json({ success: false, error: execution.error });
  }
  res.json({ success: true, data: execution });
});

module.exports = router;