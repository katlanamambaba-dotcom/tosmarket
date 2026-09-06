# TOS MARKET 8.8 Stable

Root-ready production package.

## Included
- Turkish/English storefront
- Account registration/login/logout
- Secure bcrypt password storage (passwords are never shown to admins)
- Account, profile, avatar/cover, social links
- TRX / TRON payments
- Orders and delivery
- Buyer ↔ TOS MARKET order messaging
- Admin inbox, users, orders, supplier source, payment notifications
- Auth/order activity logs
- No email verification
- No password reset by email

## Render
- Root Directory: leave blank when these files are at repository root
- Build Command: `npm install`
- Start Command: `npm start`

If JWT_SECRET is missing on an existing service, the server persists a generated signing secret in `site_settings` so login remains functional across restarts.

## Product sourcing
Admin can fill `Tedarik kaynağı / iç not` while creating/editing a product. It is private to admin and appears with the order item in the admin order screen.


## V8.9 kullanıcı mesajlaşması
- Kullanıcılar sayfasından profile girip `Mesaj gönder` ile birebir sohbet başlatılabilir.
- `/messages.html` konuşma listesi, okunmamış sayısı ve gerçek zamanlı olmayan 7 saniyelik yenileme içerir.
- Mesajlar PostgreSQL `messages` tablosunda kullanıcı gönderen/alıcı alanlarıyla saklanır.
- Admin sipariş destek mesajlaşması ayrı olarak korunur.


## V9 özel iletişim
- Profil gizliliği açık olan üyeler arasında özel mesajlaşma.
- Mesajlar, Sesli/Görüntülü, Bildirimler sekmeleri.
- WebRTC ile sesli/görüntülü görüşme ve ekran paylaşımı.
- WebSocket yalnızca görüşme sinyalleşmesi için kullanılır; medya sunucudan geçirilmez.
- Görüşme başlatmak için tarayıcı mikrofon/kamera/ekran izinleri gerekir.
