require('dotenv').config();
const express = require('express');
const path = require('path');

const { initDatabase } = require('./db/database');
const generateRoutes = require('./routes/generate');
const impactRoutes = require('./routes/impact');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', generateRoutes);
app.use('/api', impactRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Catch-all error handler so a thrown error never crashes the process.
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'An unexpected error occurred.' });
});

async function start() {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your-key-here')) {
    console.warn('⚠️  ANTHROPIC_API_KEY is not set in .env — SQL generation will fail until you add a real key.');
  }

  console.log('Building demo database (schemaDefinition.js + seedData.js)...');
  await initDatabase();
  console.log('Database ready.');

  app.listen(PORT, () => {
    console.log(`\n🚀 PS AM SQL Assistant running at http://localhost:${PORT}`);
    console.log(`   SQL Generator:    http://localhost:${PORT}/index.html`);
    console.log(`   Impact Analyzer:  http://localhost:${PORT}/impact.html\n`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
