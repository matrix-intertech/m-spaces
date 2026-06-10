const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function main() {
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.js')).sort()
      : [];

    for (const file of migrationFiles) {
      const migration = require(path.join(migrationsDir, file));
      if (typeof migration === 'function') {
        await migration(pool);
      } else if (migration && typeof migration.up === 'function') {
        await migration.up(pool);
      }
    }

    console.log('Database migrations completed successfully.');
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

if (require.main === module) {
  void main();
}

module.exports = main;
