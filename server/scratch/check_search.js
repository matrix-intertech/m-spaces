const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../db');

async function check() {
    try {
        const total = await pool.query("SELECT COUNT(*) FROM properties WHERE status = 'listed'");
        console.log("Total listed properties:", total.rows[0].count);

        const samples = await pool.query("SELECT id, title, locality, status FROM properties LIMIT 5");
        console.log("Sample properties:", samples.rows);

        const search = 'hall';
        const formattedSearch = search.replace(/[&|!():*]/g, '').trim().split(/\s+/).filter(Boolean).map(term => `${term}:*`).join(' & ');
        const query = "SELECT id, title FROM properties WHERE status = 'listed' AND to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(locality, '') || ' ' || coalesce(type, '') || ' ' || coalesce(condition, '')) @@ to_tsquery('simple', $1)";
        const res = await pool.query(query, [formattedSearch]);
        console.log(`Results for '${search}':`, res.rows.length);
        if (res.rows.length > 0) console.log("Matching titles:", res.rows.map(r => r.title));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
