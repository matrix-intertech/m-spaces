async function migrateBotResponsesGovernance(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS bot_responses (
            id SERIAL PRIMARY KEY,
            trigger_text TEXT NOT NULL,
            response_text TEXT NOT NULL
        )
    `);
}

module.exports = migrateBotResponsesGovernance;
