const pool = require('../db');
async function check() {
    try {
        const res = await pool.query("SELECT id FROM users WHERE username = 'Saksh'");
        console.log(res.rows[0]?.id || 'null');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
