const { loadEnv } = require('./load-env');
loadEnv();

const { Pool } = require('pg');

function cleanEnv(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().replace(/^['"]|['"]$/g, '');
}

const databaseUrl = cleanEnv(process.env.DATABASE_URL);
const hasDatabaseUrl = databaseUrl.length > 0;
const connectionTimeoutMillis = Number.parseInt(cleanEnv(process.env.DB_CONNECTION_TIMEOUT_MS), 10) || (process.env.VERCEL ? 10000 : 3000);
const idleTimeoutMillis = Number.parseInt(cleanEnv(process.env.DB_IDLE_TIMEOUT_MS), 10) || 30000;

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
  idleTimeoutMillis,
  connectionTimeoutMillis
});

pool.on('error', (error) => {
  console.error('[DB] Pool error:', {
    message: error?.message,
    code: error?.code,
    stack: error?.stack
  });
});

module.exports = pool;
