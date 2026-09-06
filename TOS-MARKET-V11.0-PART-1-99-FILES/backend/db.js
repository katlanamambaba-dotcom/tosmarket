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
  // Seed a polished starter catalog only when the database has no products.
  // Existing catalog data is never overwritten.
  const count = await pool.query('SELECT COUNT(*)::int AS n FROM products');
  if (Number(count.rows[0]?.n || 0) === 0) {
    const seed = [
      ['TOS Creator Pack','Creator odaklı hazır dijital paket.','Paket',349,12,'/assets/marketplace/products/tos-creator-pack.svg'],
      ['Premium Nickname','Kısa kullanıcı adı odaklı dijital ürün.','Sosyal',199,18,'/assets/marketplace/products/premium-nickname.svg'],
      ['Social Starter','Sosyal medya başlangıç paketi.','Sosyal',279,15,'/assets/marketplace/products/social-starter.svg'],
      ['Gaming Starter','Gaming toplulukları için başlangıç paketi.','Oyun',399,10,'/assets/marketplace/products/gaming-starter.svg'],
      ['Profile Design','Profil düzeni ve görsel tasarım hizmeti.','Hizmet',599,8,'/assets/marketplace/products/profile-design.svg'],
      ['Brand Kit','Mini marka kimliği ve sosyal görsel paketi.','Paket',749,7,'/assets/marketplace/products/brand-kit.svg'],
      ['Community Kit','Topluluk başlangıç materyalleri.','Oyun',499,9,'/assets/marketplace/products/community-kit.svg'],
      ['Stream Kit','Yayıncılar için görsel başlangıç paketi.','Hizmet',649,8,'/assets/marketplace/products/stream-kit.svg'],
      ['Social Audit','Sosyal profil analiz hizmeti.','Hizmet',449,10,'/assets/marketplace/products/social-audit.svg'],
      ['Discord Setup','Topluluk sunucusu kurulum hizmeti.','Hizmet',899,5,'/assets/marketplace/products/discord-setup.svg'],
      ['Avatar Pack','Profil avatar tasarım paketi.','Sosyal',299,14,'/assets/marketplace/products/avatar-pack.svg'],
      ['Creator Bundle','Creator ihtiyaçları için premium bundle.','Paket',999,5,'/assets/marketplace/products/creator-bundle.svg']
    ];
    for (const x of seed) {
      await pool.query(`INSERT INTO products(name,description,category,price,stock,image_url,delivery_text,supplier_source,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active') ON CONFLICT(name) DO NOTHING`, [x[0],x[1],x[2],x[3],x[4],x[5],'Teslimat, ödeme doğrulandıktan sonra admin operasyonu tarafından tamamlanır.','TOS MARKET operasyon kaynağı']);
    }
  }
}
module.exports = pool;
module.exports.initDb = initDb;
