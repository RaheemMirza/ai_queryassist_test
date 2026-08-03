const express = require('express');
const router = express.Router();
const appStore = require('../db/appStore');

router.get('/history/conversations', (_req, res) => {
  res.json({ success: true, data: appStore.listConversations() });
});

router.get('/history/conversations/:id', (req, res) => {
  res.json({ success: true, data: appStore.getConversation(req.params.id) });
});

router.delete('/history/conversations/:id', (req, res) => {
  appStore.deleteConversation(req.params.id);
  res.json({ success: true, data: { deleted: true } });
});

module.exports = router;