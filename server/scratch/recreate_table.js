const pool = require('../db');
async function run() {
    try {
        await pool.query('DROP TABLE IF EXISTS property_conversations CASCADE');
        await pool.query('DROP TABLE IF EXISTS chat_messages CASCADE');
        await pool.query(`CREATE TABLE property_conversations (
            id SERIAL PRIMARY KEY,
            property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
            buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            last_message TEXT,
            last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            unread_count_owner INTEGER DEFAULT 0,
            unread_count_buyer INTEGER DEFAULT 0,
            deleted_by INTEGER[] DEFAULT '{}',
            UNIQUE(property_id, buyer_id, owner_id)
        )`);
        await pool.query(`CREATE TABLE chat_messages (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER REFERENCES property_conversations(id) ON DELETE CASCADE,
            sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            content TEXT,
            visibility VARCHAR(20) DEFAULT 'private',
            is_read BOOLEAN DEFAULT FALSE,
            deleted_by INTEGER[] DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('Successfully recreated property_conversations and chat_messages with INTEGER[] deleted_by');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
run();
