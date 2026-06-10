const pool = require('./db');

async function addAvatarUrlColumn() {
    try {
        console.log("Adding avatar_url column to users table...");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT");
        console.log("Success! avatar_url column added.");
    } catch (err) {
        console.error("Error adding column:", err.message);
    }
    process.exit();
}

addAvatarUrlColumn();
