const pool = require('./db');

async function addPhoneColumn() {
    try {
        console.log("Adding phone column to users table...");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT");
        console.log("Success! Phone column added.");
    } catch (err) {
        console.error("Error adding column:", err.message);
    }
    process.exit();
}

addPhoneColumn();