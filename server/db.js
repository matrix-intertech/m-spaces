require('dotenv').config();
const { Pool } = require('pg');

const hasDatabaseUrl = !!process.env.DATABASE_URL;

const poolConfig = hasDatabaseUrl
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    };

const pool = new Pool({
  ...poolConfig,
  max: 30, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds to free up memory
  connectionTimeoutMillis: 3000, // Return an error after 3s if DB is unresponsive
});

module.exports = pool;
