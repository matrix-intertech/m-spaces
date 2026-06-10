const migrateDatabase = require('./migrate-db');

async function main() {
    try {
        console.log('Legacy helper detected: create_visits_table.js now delegates to ordered migrations.');
        await migrateDatabase();
    } catch (error) {
        console.error('Visit table migration wrapper failed:', error);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    void main();
}

module.exports = main;
