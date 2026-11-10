# Petalya — website + admin dashboard

Bilingual (Arabic RTL / English) bakery site built from the design handoff in `../design_handoff_petalya_website`, with real ordering and an admin dashboard.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

Copy `.env.example` to `.env` and set `ADMIN_PASSWORD` and `SESSION_SECRET` **before the first start** — the password is only read when the database is created. It can be changed later from Admin → Settings → Security.

Default admin login (local only): `/admin` with password `petalya-admin`.

## What's where

| URL | What |
|---|---|
| `/` | The website (hero, gallery, menu, flowers, cake builder, reviews, contact) |
| `/checkout` | Cart review, details, delivery/pick-up, date & time slot, payment, promo code |
| `/order/<id>` | Confirmation + live order tracking (auto-refreshes), review form once delivered |
| `/track` | Find an order by order number + phone |
| `/links` | Link-in-bio page for Instagram |
| `/admin` | Dashboard: sales, visitors, conversion funnel, week schedule, top products |
| `/admin/orders` | Orders by status, search, filters, CSV export; detail page with status flow, WhatsApp updates to the customer, payment, notes, print |
| `/admin/products` | Add / edit / hide / delete products, multiple photos (drag & drop, auto-resized to WebP), categories, ordering, sold-out toggle, live menu preview |
| `/admin/gallery`, `/admin/reviews`, `/admin/coupons`, `/admin/customers`, `/admin/analytics` | Content and insights |
| `/admin/settings` | WhatsApp number, open/closed, lead days, delivery zones & fees, time slots, payment methods, cake-builder prices, password, backup, demo data |

## Install as an app + order alerts on the phone

**Customers:** the site is a PWA. A few seconds after they land, an *Install the Petalya app* card appears (Android/Chrome/desktop: one tap installs it; iPhone: it shows the Share → *Add to Home Screen* steps). There is also an *Install the app* link in the mobile menu. Installing needs HTTPS (Railway gives you that) — it also works on `localhost`.

**Owner:** the dashboard is its own installable app (`/admin-manifest.webmanifest`, opens on the orders). In `/admin` a card offers *Enable notifications*; after that every new order sends a push notification to the phone — like a WhatsApp message, even when the app is closed — and tapping it opens that order. Manage it (test / turn off) in **Settings**.

- Android: open the dashboard in Chrome → *Install app* → *Enable notifications*.
- iPhone/iPad (iOS 16.4+): iOS only delivers notifications to apps on the Home Screen: Safari → Share → *Add to Home Screen*, open it from the icon, then *Enable notifications*.
- Every phone/computer you enable it on gets the alert. Keys (VAPID) are created automatically and stored in the database; to pin your own set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (and optionally `VAPID_SUBJECT`) in the environment (`npx web-push generate-vapid-keys`). Changing the keys means re-enabling notifications on each device.
- Icons live in `public/icons` (regenerate them from the logo with `node scripts/gen-icons.mjs`).

## Customer accounts

Customers can sign up with email + password or **Continue with Google** (`/account/login`, `/account/register`). Guest checkout still works. Signed-in customers get:

- details filled in automatically at checkout (phone and address are saved from their first order)
- `/account`: their orders with live status, one-tap **Reorder**, profile and password

In the admin, **Customers** shows who has an account (Google / email). If someone forgets their password, use the key button to issue a temporary one and send it on WhatsApp.

### Turning on Google sign-in

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) and create a project.
2. Configure the **OAuth consent screen** (External, app name "Petalya", support email, logo), then publish it.
3. **Create credentials → OAuth client ID → Web application**. Under *Authorised redirect URIs* add:
   - `http://localhost:3000/api/auth/google/callback` (for testing)
   - `https://YOUR-DOMAIN/api/auth/google/callback` (live site)
4. Put the values in `.env` and restart:

```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
APP_URL=https://YOUR-DOMAIN
```

The Google button only appears once both values are set.

## Data

Everything is stored in `data/` (override with `PETALYA_DATA_DIR`):

- `db.json` — products, orders, settings… (created from `lib/content.json` on first start)
- `events.jsonl` — anonymous visit / add-to-cart / WhatsApp-click events for analytics
- `uploads/` — images uploaded from the dashboard

Host it somewhere with a **persistent disk** (a VPS, Railway/Render/Fly with a volume). Serverless hosts like Vercel do not keep files between requests, so orders and uploads would be lost there. Download a backup weekly from Settings → Security.

Prices are always recalculated on the server from the database; the browser's prices are never trusted.

## Before launch

- Replace the placeholder WhatsApp number, InstaPay handle and wallet number in Settings.
- Replace the low-res photos in `public/assets/` (or upload new ones from the dashboard).
- Remove the demo data (Settings → Security) if it was loaded.
- Confirm prices, zones and reviews with the client (they are placeholders from the design).

## Deploy on Railway

1. Put the `petalya` folder in its own GitHub repo (or, if the repo contains more, set the service's **Root Directory** to `petalya`). Do not commit `.env` or `data/` (both are git-ignored).
2. Railway → **New Project → Deploy from GitHub repo**. It builds the `Dockerfile` and uses `railway.json` (health check on `/api/health`).
3. Service → **Variables**. Run `npm run secrets` locally and paste the two values it prints:
   - `ADMIN_PASSWORD` — the first admin login (the app refuses to start in production without a strong one)
   - `SESSION_SECRET`
4. Service → **Volumes → Add Volume**, mount path `/data`. Everything (orders, products, uploads, analytics) lives there — without the volume it is lost on every deploy.
5. Service → **Settings → Networking → Generate Domain** (or add your own). The public address is picked up automatically from `RAILWAY_PUBLIC_DOMAIN`; set `APP_URL` only when you use a custom domain.
6. Keep **one replica** (the database is a file on the volume).
7. Open `/admin`, then in Settings: set the real WhatsApp number, InstaPay handle and wallet number, check prices/zones, and make sure no demo data is loaded.
8. Optional Google sign-in: add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and the redirect URI `https://YOUR-DOMAIN/api/auth/google/callback`.

Security notes: sessions are signed and tied to the password (changing it signs everyone out), login and public endpoints are rate-limited, cross-site API requests are rejected, uploads are checked by content, and security headers + CSP are sent in production. Take a backup from Settings → Security regularly.
