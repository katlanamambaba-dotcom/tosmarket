CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category VARCHAR(60) NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url VARCHAR(500), image_data BYTEA, image_mime VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_category_status_idx ON products(category,status);
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY, customer_name VARCHAR(120) NOT NULL, customer_email VARCHAR(255) NOT NULL,
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0), status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','processing','completed','cancelled')),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'crypto_email', note TEXT, payment_token VARCHAR(64), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_token VARCHAR(64);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('crypto_email','crypto_trc20'));
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_token_idx ON orders(payment_token) WHERE payment_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders(customer_email); CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE TABLE IF NOT EXISTS order_items (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id BIGINT,
 product_name VARCHAR(180) NOT NULL, quantity INTEGER NOT NULL CHECK (quantity>0), unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price>=0)
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
CREATE TABLE IF NOT EXISTS crypto_payments (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
 payment_token VARCHAR(64) NOT NULL, network VARCHAR(20) NOT NULL, token VARCHAR(20) NOT NULL,
 expected_amount NUMERIC(24,6) NOT NULL, received_amount NUMERIC(24,6), payment_address VARCHAR(64) NOT NULL,
 tx_hash VARCHAR(128), status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','confirmed','expired')),
 expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS crypto_payments_status_idx ON crypto_payments(status);
CREATE TABLE IF NOT EXISTS messages (
 id BIGSERIAL PRIMARY KEY, customer_name VARCHAR(120) NOT NULL, customer_email VARCHAR(255) NOT NULL, subject VARCHAR(255) NOT NULL,
 body TEXT NOT NULL, direction VARCHAR(20) NOT NULL DEFAULT 'inbound' CHECK(direction IN ('inbound','outbound')), thread_id BIGINT,
 is_read BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at DESC); CREATE INDEX IF NOT EXISTS messages_thread_id_idx ON messages(thread_id);
INSERT INTO products(name,description,category,price,stock,status) VALUES
('Instagram 4 Haneli Kullanıcı Adı — 4827','4 haneli kullanıcı adı kategorisinde örnek ilan.','Sosyal',2499,1,'active'),
('Instagram 4 Haneli Kullanıcı Adı — 7316','4 haneli kullanıcı adı kategorisinde örnek ilan.','Sosyal',1999,1,'active'),
('Discord 4 Haneli Kullanıcı Adı — 2048','4 haneli kullanıcı adı kategorisinde örnek ilan.','Sosyal',199,1,'active'),
('Discord 4 Haneli Kullanıcı Adı — 5731','4 haneli kullanıcı adı kategorisinde örnek ilan.','Sosyal',299,1,'active'),
('TikTok 4 Haneli Kullanıcı Adı — 6194','4 haneli kullanıcı adı kategorisinde örnek ilan.','Sosyal',999,1,'active'),
('TikTok 4 Haneli Kullanıcı Adı — 8462','4 haneli kullanıcı adı kategorisinde örnek ilan.','Sosyal',1299,1,'active'),
('Premium Dijital Paket','Örnek premium dijital ürün paketi.','Paket',499,10,'active'),
('Özel Dijital Hizmet','Örnek dijital hizmet ilanı.','Hizmet',999,5,'active') ON CONFLICT(name) DO NOTHING;
