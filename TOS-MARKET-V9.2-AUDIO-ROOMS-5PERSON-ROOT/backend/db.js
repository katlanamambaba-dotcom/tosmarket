const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
  // Existing Render services may not have a JWT_SECRET environment variable.
  // Persist one once in the database so sessions keep working across restarts.
  if (!process.env.JWT_SECRET) {
    const r = await pool.query("SELECT value FROM site_settings WHERE key='jwt_secret' LIMIT 1");
    if (r.rows[0]?.value) process.env.JWT_SECRET = r.rows[0].value;
    else {
      const secret = crypto.randomBytes(48).toString('hex');
      await pool.query("INSERT INTO site_settings(key,value) VALUES('jwt_secret',$1) ON CONFLICT(key) DO NOTHING", [secret]);
      const rr = await pool.query("SELECT value FROM site_settings WHERE key='jwt_secret' LIMIT 1");
      process.env.JWT_SECRET = rr.rows[0]?.value || secret;
    }
  }
}
module.exports = pool;
module.exports.initDb = initDb;
