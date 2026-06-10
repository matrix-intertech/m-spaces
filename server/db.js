const { loadEnv } = require('./load-env');
loadEnv();

const { Pool } = require('pg');

function cleanEnv(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().replace(/^['"]|['"]$/g, '');
}

const databaseUrl = cleanEnv(process.env.DATABASE_URL);
const hasDatabaseUrl = databaseUrl.length > 0;

const poolConfig = hasDatabaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    }
  : {
      user: cleanEnv(process.env.DB_USER) || undefined,
      host: cleanEnv(process.env.DB_HOST) || undefined,
      database: cleanEnv(process.env.DB_NAME) || undefined,
      password: cleanEnv(process.env.DB_PASSWORD) || undefined,
      port: Number.parseInt(cleanEnv(process.env.DB_PORT), 10) || 5432
    };

const pool = new Pool({
  ...poolConfig,
  max: 30,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000
});

module.exports = pool;
