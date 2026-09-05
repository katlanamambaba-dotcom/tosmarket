# TOS MARKET v7 — Professional Marketplace

Bu sürüm TOS MARKET'i baştan sona marketplace mantığıyla yeniler.

## Öne çıkanlar
- TRON ağında **TRX** ödeme: `TFz4LPNhbdL2N33BSzC7QdNrVPn9MJneMj`
- Checkout sonrası ayrı **Ödeme Bildirimi** ekranı
- Ödeme bildirimi admin Control Room'a düşer
- Blockchain üzerinden TRX transferi otomatik kontrol edilir
- Siparişe özel TRX tutarı: TL → USD → TRX, oran siparişte kilitlenir
- USD/TRY başlangıç kuru **50 TL**, admin panelinden değiştirilebilir
- Anlık TRX/USD fiyatı CoinGecko'dan denenir; fallback oranı admin/env ile ayarlanabilir
- Nickname ile kullanıcı kaydı, login, profil, avatar ve bio
- Şifreler bcrypt hash olarak tutulur; düz metin şifre saklanmaz
- Satın alınan ürünler için 1–5 yıldız ve yorum sistemi
- Gerçek zamanlı destek mesajları + admin birebir yanıt
- TOS AI: `OPENAI_API_KEY` verilirse Responses API üzerinden gerçek AI; anahtar yoksa yerleşik akıllı destek fallback'i
- Modern dark / midnight marketplace tasarımı; ayrı Market / User Hub / Settings / Privacy / Support / Crypto / Quick Links sayfaları.
- Admin'den tema, ödeme adresi, USD/TRY, TRX fallback, ödeme süresi ve mağaza ayarları
- Otomatik teslimat alanı: ödeme doğrulanınca sipariş sayfasında görünür
- Private admin Control Room; public `/admin` 404
- Kullanıcı hesabı için ayrı Profil, Siparişler, Ayarlar, Gizlilik, Destek, Kripto ve Quick Links sayfaları
- Public profile görünürlüğü kullanıcı tarafından kapatılabilir; e-posta public profilde gösterilmez
- Canlı destekte PNG/JPG/WebP/GIF fotoğraf ekleme
- TOS AI günlük selamlaşmaları ("Naber?" vb.) ve AI → canlı destek geçişini destekler
- TR / EN / DE / AR dil seçeneği

## Render Environment
Minimum:
- `NODE_ENV=production`
- `DATABASE_URL=<Render Postgres Internal URL>`
- `DB_SSL=true`
- `JWT_SECRET=<random secret>`
- `ADMIN_EMAIL=<admin email>`
- `ADMIN_PASSWORD=<admin password>`
- `ADMIN_PATH=control-room-7x91`
- `TRX_PAYMENT_ADDRESS=TFz4LPNhbdL2N33BSzC7QdNrVPn9MJneMj`
- `TRON_API_URL=https://api.trongrid.io`
- `CRYPTO_PAYMENT_EXPIRY_MINUTES=30`
- `TRX_USD_RATE=0.332`
- `TRONGRID_API_KEY=<production recommended>`

Optional real AI:
- `OPENAI_API_KEY=<your key>`
- `OPENAI_MODEL=gpt-5.6-luna`

## Admin
Default private path:
`/control-room-7x91`

Do not publish the admin path. Keep admin password, JWT secret and API keys only in Render Environment Variables.

## Security
Public wallet address is safe to show. Never put a private key or seed phrase into the project, database, HTML, frontend JavaScript, screenshots or Render public variables.

No website can promise that it is impossible to hack; this build keeps passwords hashed and sensitive server settings out of frontend code, but production security still depends on Render, database, dependencies, admin credentials and operational practices.


## Deployment
Bu paket **repo-root ready**. GitHub repo köküne dosyaları koyarsan Render `Root Directory` **boş** kalmalı. Build Command `npm install`, Start Command `npm start`.

Build marker: `7.2.0-account-hub`. `/health` ve `/api/version` üzerinden doğrulanabilir.

Not: Telegram bağlantısı kodda `https://t.me/tosmarket` olarak ayarlı; gerçek Telegram kullanıcı adın farklıysa `index.html`, `links.html`, `support.html` ve ortak footer linklerini değiştir.
