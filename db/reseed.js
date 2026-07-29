require('dotenv').config();
const { initDatabase, runSelect } = require('./database');
const { tables } = require('./schemaDefinition');

/**
 * Quick sanity check: builds the database from schemaDefinition.js +
 * seedData.js and prints a row count per table. Useful after editing the
 * schema or seed data, to confirm everything still loads cleanly — no
 * AI key or running server required.
 *
 * Usage: npm run reseed
 */
(async () => {
  console.log('Building database from schemaDefinition.js + seedData.js...\n');
  await initDatabase();

  for (const tableName of Object.keys(tables)) {
    const { rows } = runSelect(`SELECT COUNT(*) as count FROM ${tableName}`);
    console.log(`  ${tableName}: ${rows[0].count} row(s)`);
  }

  console.log('\n✅ Schema and seed data build successfully with no errors.');
})().catch((err) => {
  console.error('\n❌ Failed to build the database:');
  console.error(err.message);
  process.exit(1);
});
