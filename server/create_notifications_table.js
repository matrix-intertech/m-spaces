const pool = require('./db');

async function createNotificationsTable() {
    try {
        console.log("Creating notifications table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                content TEXT NOT NULL,
                link TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Success! Notifications table created.");
    } catch (err) {
        console.error("Error creating table:", err.message);
    }
    process.exit();
}

createNotificationsTable();