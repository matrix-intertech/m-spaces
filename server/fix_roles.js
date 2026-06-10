const pool = require('./db');

async function fixRoles() {
    try {
        console.log("Updating database constraints...");
        await pool.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        console.log("Sanitizing existing roles... (skipped to preserve existing roles like dealer, agent)");
        console.log("Success! You can now sign up with all roles.");
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit();
}

fixRoles();