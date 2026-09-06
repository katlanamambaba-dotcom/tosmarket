# TOS MARKET 8.7 — Final Account & Auth

## Render
Bu paket **repo-root hazırdır**. GitHub deposunun kökünde `package.json`, `app.js`, HTML dosyaları, `assets/`, `backend/` ve `database/` bulunmalıdır.

- Render **Root Directory: boş bırak**
- Build Command: `npm install`
- Start Command: `npm start`
- Node: `>=18`

## Özellikler
- TRX / TRON ödeme akışı
- Kullanıcı kayıt / giriş
- Gerçek e-posta doğrulama kodu
- Şifremi unuttum + tek kullanımlık sıfırlama kodu
- Kişisel profil ID, avatar, bio ve sosyal bağlantılar
- Profil arka planı: JPG/PNG/WebP/GIF veya MP4/WebM
- Cache-busting ve no-store medya yanıtları ile anlık avatar/kapak yenileme
- Public kullanıcı dizini ve public profil
- TR / EN site dili; seçim localStorage ile tüm sayfalarda uygulanır
- Türkçe admin Control Room
- Kullanıcı yönetimi: aktif / askıda / engelli, çevrimiçi durumu, doğrulama durumu, profil görünürlüğü, moderasyon notu
- Siparişlerde müşteri, e-posta, ürün/adet, tutar, TRX ve işlem durumu görünür
- Deneme sipariş/ödeme/destek/yorum kayıtlarını admin üzerinden tek seferlik temizleme
- Admin paneli ayrı gizli URL'de
- Admin panelinden public site iframe/gezinti özelliği kaldırıldı

## E-posta ortam değişkenleri
Üretimde kayıt ve şifre sıfırlama için  gereklidir:

```env
_HOST=
_PORT=587
_SECURE=false
_USER=
_PASS=
MAIL_FROM=
STORE_PUBLIC_URL=https://www.tos.quest
```

API anahtarlarını veya  şifresini sohbete yazmayın; Render Environment Variables bölümüne girin.

## Admin
`ADMIN_PATH` ile belirlenen gizli URL kullanılır. Public `/admin` adresi açılmaz.

## Medya
Avatar 2 MB, profil arka planı 15 MB ile sınırlandırılmıştır. Seed phrase, private key, kart bilgisi veya kullanıcı şifresi siteye yüklenmemelidir.
