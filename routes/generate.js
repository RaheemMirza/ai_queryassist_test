const express = require('express');
const router = express.Router();

const { handleUserMessage } = require('../services/aiService');
const { classifyStatement } = require('../services/sqlSafety');
const { runSelect } = require('../db/database');
const { previewExecute } = require('../services/queryExecutor');
const appStore = require('../db/appStore');

const MAX_HISTORY_MESSAGES = 10;

function buildHistoryForAI(conversationId) {
  const messages = appStore.getConversation(conversationId);
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);

  return recent.map((m) => {
    if (m.role === 'user') {
      return { role: 'user', content: m.content };
    }
    if (m.type === 'sql') {
      return { role: 'assistant', content: `${m.reply || ''}\n\nSQL used: ${m.sql || ''}`.trim() };
    }
    return { role: 'assistant', content: m.reply || '' };
  });
}

router.post('/generate-sql', async (req, res) => {
  try {
    const { prompt, conversationId } = req.body;
    if (!prompt || prompt.trim().length < 1) {
      return res.status(422).json({ success: false, error: 'Please enter a message.' });
    }
    if (!conversationId) {
      return res.status(422).json({ success: false, error: 'Missing conversationId.' });
    }

    const historyForAI = buildHistoryForAI(conversationId);

    appStore.addMessage(conversationId, { role: 'user', content: prompt.trim() });

    const result = await handleUserMessage(prompt.trim(), historyForAI);

    if (result.type === 'chat') {
      appStore.addMessage(conversationId, { role: 'assistant', type: 'chat', reply: result.reply });
      return res.json({ success: true, data: { type: 'chat', reply: result.reply } });
    }

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
      reply: result.reply,
      sql: result.sql,
      explanation: result.explanation,
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

router.post('/run-query', (req, res) => {
  const { sql } = req.body;
  const execution = previewExecute(sql);
  if (!execution.success) {
    return res.status(400).json({ success: false, error: execution.error });
  }
  res.json({ success: true, data: execution });
});

module.exports = router;