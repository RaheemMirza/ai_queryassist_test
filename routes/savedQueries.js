const express = require('express');
const router = express.Router();
const appStore = require('../db/appStore');

router.get('/saved-queries', (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  res.json({ success: true, data: appStore.listSavedQueries(search) });
});

router.post('/saved-queries', (req, res) => {
  const { name, sql, description } = req.body;
  if (!name || !name.trim() || !sql || !sql.trim()) {
    return res.status(422).json({ success: false, error: 'Name and SQL are both required.' });
  }
  const query = appStore.saveQuery({ name: name.trim(), sql: sql.trim(), description });
  res.json({ success: true, data: query });
});

router.patch('/saved-queries/:id', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(422).json({ success: false, error: 'Name is required.' });
  }
  const updated = appStore.renameSavedQuery(req.params.id, name.trim());
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Saved query not found.' });
  }
  res.json({ success: true, data: updated });
});

router.delete('/saved-queries/:id', (req, res) => {
  appStore.deleteSavedQuery(req.params.id);
  res.json({ success: true, data: { deleted: true } });
});

module.exports = router;
