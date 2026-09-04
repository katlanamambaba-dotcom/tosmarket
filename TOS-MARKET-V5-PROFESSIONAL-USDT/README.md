# TOS MARKET v5 — Guest Checkout + USDT / TRC20

Professional dark marketplace with guest checkout, live order tracking, USDT/TRC20 blockchain verification, multilingual UI (TR/EN/DE), live support and a private admin control room.

## Customer flow
1. Browse products.
2. Add to cart — toast notification appears.
3. Checkout without name/email/account.
4. Server creates an order and private tracking token.
5. The site shows the exact USDT amount, TRC20 address and QR code.
6. Customer pays from Exodus, RedotPay or another wallet using USDT on TRON/TRC20.
7. The backend checks the TRON blockchain and confirms the transaction.
8. The order page updates to PAID. If the product has `delivery_text`, it is shown automatically after payment.

## Environment variables on Render
Required:
- `DATABASE_URL`
- `DB_SSL=true`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_PATH` (private admin URL segment)
- `USDT_TRC20_ADDRESS`
- `USDT_TRY_RATE`

Recommended:
- `TRONGRID_API_KEY`
- `TRON_API_URL=https://api.trongrid.io`
- `CRYPTO_PAYMENT_EXPIRY_MINUTES=30`

The USDT contract defaults to the official TRON USDT contract in `backend/routes/crypto.js`; you do not need to provide a personal contract address.

## Render
If the GitHub repository contains these files at its root, set:
- Root Directory: blank
- Build Command: `npm install`
- Start Command: `npm start`

If you upload this project into a subfolder, set Root Directory to that exact subfolder instead.

## Admin
The public site does not contain an admin link. The admin page is served only at the value of `ADMIN_PATH` and still requires `ADMIN_EMAIL` + `ADMIN_PASSWORD`.

Default path in this package: `/control-room-7x91` — change it on Render if desired.

## Automatic delivery
In Control Room → Products, use `Otomatik teslimat içeriği` for digital codes, text-based credentials, or delivery instructions that should appear only after blockchain-confirmed payment. Do not put sensitive seed phrases/private keys in the site.
