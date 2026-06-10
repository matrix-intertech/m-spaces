const BotService = require('./bot-service');
const pool = require('./db');

async function main() {
  try {
    await BotService.ensureSchema();
    await BotService.seedDefaults();
    console.log('Database seed completed successfully.');
  } catch (error) {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

if (require.main === module) {
  void main();
}

module.exports = main;
