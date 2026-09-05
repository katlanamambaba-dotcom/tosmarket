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
- Modern dark / midnight marketplace tasarımı; TRX ödeme ve bildirim akışı görünür şekilde ayrıştırıldı.
- Admin'den tema, ödeme adresi, USD/TRY, TRX fallback, ödeme süresi ve mağaza ayarları
- Otomatik teslimat alanı: ödeme doğrulanınca sipariş sayfasında görünür
- Private admin Control Room; public `/admin` 404

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
GitHub repo kökünde bu klasörün içeriği bulunuyorsa Root Directory boş bırakılabilir. Eğer GitHub içinde `tosv7/` klasörü altında duruyorsa Render Root Directory `tosv7` olmalıdır.

Build marker: `7.0.0-trx-ultra`. `/health` ve `/api/version` üzerinden doğrulanabilir.
