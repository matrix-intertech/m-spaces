const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

let loaded = false;

function loadEnv() {
    if (loaded) return;
    loaded = true;

    const cwd = process.cwd();
    const candidates = [
        path.resolve(cwd, 'server/.env'),
        path.resolve(cwd, '.env'),
        path.join(__dirname, '.env'),
        path.join(__dirname, '../.env')
    ];

    const seen = new Set();
    for (const candidate of candidates) {
        const normalized = path.resolve(candidate);
        if (seen.has(normalized) || !fs.existsSync(normalized)) continue;
        seen.add(normalized);
        dotenv.config({ path: normalized, quiet: true });
    }
}

module.exports = { loadEnv };
