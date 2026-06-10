const initializeDatabase = require('../db-init');

module.exports = async function migrateInitialSchema() {
  // This migration is the current bootstrap bridge while db-init.js is being
  // decomposed into explicit, ordered migrations. See docs/schema-governance.md.
  await initializeDatabase();
};
