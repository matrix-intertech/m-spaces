const migrateDatabase = require('./migrate-db');
const seedDatabase = require('./seed-db');

async function main() {
    try {
        console.log('Legacy helper detected: bot.js now delegates to migrations and bot seeding.');
        await migrateDatabase();
        await seedDatabase();
    } catch (error) {
        console.error('Bot migration wrapper failed:', error);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    void main();
}

module.exports = main;
