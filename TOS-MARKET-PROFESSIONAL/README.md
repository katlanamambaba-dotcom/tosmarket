# TOS MARKET — Render + PostgreSQL

TOS MARKET is a Turkish digital marketplace with a public storefront and private `/admin` panel.

## Render setup

- Runtime: Node
- Plan: Free
- Build: `npm install`
- Start: `npm start`
- Health check: `/health`
- Database: Render PostgreSQL

Set `DATABASE_URL` to the Render Postgres **Internal Database URL**. The application automatically creates tables and demo products at startup.

### Free-plan limitations

Render Free web services use 0.1 CPU / 512 MB RAM and spin down after inactivity. The filesystem is ephemeral, so product images uploaded from the admin panel are stored in PostgreSQL instead of the local `uploads` folder.

Render Free PostgreSQL is currently limited to 1 GB and expires after 30 days. It is therefore appropriate for testing/hobby use, not permanent production data. See Render's current Free-plan documentation before relying on it for live orders.

### Email on Render Free

Render Free web services cannot send outbound traffic on SMTP ports 25/465/587. This project supports Resend's HTTPS API through `RESEND_API_KEY`. Verify `tos.quest` with your email provider and set `MAIL_FROM` to the verified sender. SMTP remains available as a fallback for local/paid environments.

## Public routes

- `/`
- `/cart.html`
- `/checkout.html`
- `/contact.html`
- `/product.html?id=PRODUCT_ID`
- `/admin` (not linked from the public navigation)

## Admin

Admin can add/edit/deactivate listings, upload images, manage stock and price, view orders, update order status, read messages and reply to customers.

## Payment

Checkout creates a pending order. Payment instructions are handled manually by email at `info@tos.quest`. No card details or private crypto keys are stored.
