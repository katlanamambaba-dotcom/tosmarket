const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const poolConfig = process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME
};
if (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production') poolConfig.ssl = { rejectUnauthorized: false };
const pool = new Pool({ ...poolConfig, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
pool.on('error', err => console.error('PostgreSQL pool error:', err.message));
async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'tos_market.sql'), 'utf8');
  await pool.query(schema);
}
module.exports = pool;
module.exports.initDb = initDb;
