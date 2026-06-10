const pool = require('../db');
async function check() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'properties'");
        console.log(res.rows.map(r => r.column_name).join(', '));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
