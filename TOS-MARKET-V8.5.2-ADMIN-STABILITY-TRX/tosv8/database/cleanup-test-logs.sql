-- TOS MARKET: mevcut deneme işlem kayıtlarını temizler.
-- Kullanıcı ve ürün kayıtlarına dokunmaz. İhtiyaç halinde manuel olarak bir kez çalıştırılabilir.
BEGIN;
DELETE FROM payment_notifications;
DELETE FROM crypto_payments;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM messages;
DELETE FROM reviews;
COMMIT;
