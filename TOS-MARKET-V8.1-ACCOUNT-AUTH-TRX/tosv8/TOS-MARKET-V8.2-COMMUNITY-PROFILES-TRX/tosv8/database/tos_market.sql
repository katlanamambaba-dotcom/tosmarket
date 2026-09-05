CREATE TABLE IF NOT EXISTS site_settings (key VARCHAR(80) PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO site_settings(key,value) VALUES
('usd_try_rate','50'),('trx_usd_rate','0.332'),('payment_address','TFz4LPNhbdL2N33BSzC7QdNrVPn9MJneMj'),('theme','midnight'),('payment_expiry_minutes','30'),('store_name','TOS MARKET'),('store_tagline','Premium dijital marketplace')
ON CONFLICT(key) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY,
 nickname VARCHAR(24) NOT NULL UNIQUE,
 email VARCHAR(255),
 password_hash TEXT NOT NULL,
 display_name VARCHAR(60) NOT NULL,
 bio VARCHAR(500) NOT NULL DEFAULT '',
 avatar_data BYTEA,
 avatar_mime VARCHAR(100),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_nickname_idx ON users(nickname);
CREATE TABLE IF NOT EXISTS user_preferences (
 user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 profile_public BOOLEAN NOT NULL DEFAULT TRUE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS user_socials (
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 platform VARCHAR(24) NOT NULL,
 url VARCHAR(500) NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(user_id, platform)
);
CREATE INDEX IF NOT EXISTS user_socials_platform_idx ON user_socials(platform);

CREATE TABLE IF NOT EXISTS products (
 id BIGSERIAL PRIMARY KEY,
 name VARCHAR(180) NOT NULL UNIQUE,
 description TEXT NOT NULL,
 category VARCHAR(60) NOT NULL,
 price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
 stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
 image_url VARCHAR(500), image_data BYTEA, image_mime VARCHAR(100), delivery_text TEXT,
 status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_category_status_idx ON products(category,status);

CREATE TABLE IF NOT EXISTS orders (
 id BIGSERIAL PRIMARY KEY, customer_name VARCHAR(120) NOT NULL DEFAULT 'Guest Buyer', customer_email VARCHAR(255),
 total NUMERIC(12,2) NOT NULL CHECK (total >= 0), status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','processing','completed','cancelled')),
 payment_method VARCHAR(30) NOT NULL DEFAULT 'crypto_trx', note TEXT, payment_token VARCHAR(64), user_id BIGINT, customer_nickname VARCHAR(40), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_token VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_nickname VARCHAR(40);
ALTER TABLE orders ALTER COLUMN customer_email DROP NOT NULL;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('crypto_email','crypto_trc20','crypto_trx'));
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_token_idx ON orders(payment_token) WHERE payment_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders(customer_email); CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status); CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id);

CREATE TABLE IF NOT EXISTS order_items (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id BIGINT,
 product_name VARCHAR(180) NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), unit_price NUMERIC(12,2) NOT NULL CHECK(unit_price>=0)
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_text TEXT;

CREATE TABLE IF NOT EXISTS crypto_payments (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
 payment_token VARCHAR(64) NOT NULL, network VARCHAR(20) NOT NULL, token VARCHAR(20) NOT NULL,
 expected_amount NUMERIC(24,6) NOT NULL, received_amount NUMERIC(24,6), payment_address VARCHAR(64) NOT NULL,
 tx_hash VARCHAR(128), status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','confirmed','expired')),
 expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), confirmed_at TIMESTAMPTZ, rate_snapshot TEXT
);
ALTER TABLE crypto_payments ADD COLUMN IF NOT EXISTS rate_snapshot TEXT;
CREATE INDEX IF NOT EXISTS crypto_payments_status_idx ON crypto_payments(status); CREATE INDEX IF NOT EXISTS crypto_payments_tx_idx ON crypto_payments(tx_hash);

CREATE TABLE IF NOT EXISTS payment_notifications (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 guest_token VARCHAR(64), tx_hash VARCHAR(128), note VARCHAR(500), status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed','matched')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payment_notifications_status_idx ON payment_notifications(status,created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
 id BIGSERIAL PRIMARY KEY, customer_name VARCHAR(120) NOT NULL DEFAULT 'Guest Buyer', customer_email VARCHAR(255), subject VARCHAR(255) NOT NULL,
 body TEXT NOT NULL, direction VARCHAR(20) NOT NULL DEFAULT 'inbound' CHECK(direction IN ('inbound','outbound')), thread_id BIGINT, guest_token VARCHAR(64),
 attachment_data BYTEA, attachment_mime VARCHAR(100), attachment_name VARCHAR(255),
 is_read BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_data BYTEA;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_mime VARCHAR(100);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS guest_token VARCHAR(64); ALTER TABLE messages ALTER COLUMN customer_email DROP NOT NULL;
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at DESC); CREATE INDEX IF NOT EXISTS messages_thread_id_idx ON messages(thread_id); CREATE INDEX IF NOT EXISTS messages_guest_token_idx ON messages(guest_token);

CREATE TABLE IF NOT EXISTS reviews (
 id BIGSERIAL PRIMARY KEY, product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), body VARCHAR(1000) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(product_id,user_id)
);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews(product_id,created_at DESC);

INSERT INTO products(name,description,category,price,stock,status) VALUES
('Instagram 4 Haneli Kullanıcı Adı — 4827','4 haneli kullanıcı adı kategorisinde örnek ilan. Kurucu mail / transfer durumu ürün açıklamasında ayrıca belirtilir.','Sosyal',2499,1,'active'),
('Instagram 4 Haneli Kullanıcı Adı — 7316','Kısa kullanıcı adı koleksiyonu için örnek premium ilan.','Sosyal',1999,1,'active'),
('Discord 4 Haneli Kullanıcı Adı — 2048','Discord tarafında kısa ve akılda kalıcı kullanıcı adı kategorisi.','Sosyal',199,1,'active'),
('TikTok 4 Haneli Kullanıcı Adı — 6194','Kısa kullanıcı adı kategorisinde örnek ilan.','Sosyal',999,1,'active'),
('Premium Dijital Paket','Dijital ürün ve hizmetlerden oluşan örnek premium paket.','Paket',499,10,'active'),
('Özel Dijital Hizmet','Kişiye özel dijital hizmet ilanı.','Hizmet',999,5,'active'),
('Gaming Premium Paket','Oyun odaklı dijital paket kategorisi.','Oyun',799,8,'active'),
('Creator Starter Paket','İçerik üreticileri için dijital başlangıç paketi.','Paket',649,12,'active')
ON CONFLICT(name) DO NOTHING;
