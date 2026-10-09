# tuli (tulidocs.com)

Invoices, quotes and receipts for small businesses anywhere — multi-tenant SaaS. Global by default, with local extras where they matter (M-Pesa and KRA eTIMS for Kenya).

- **Guests** build documents with no sign-up. PDFs carry a watermark until they pay for that document (**$2**, or **KES 100** in Kenya), or create an account. Paid documents can switch templates freely; edits within 24 h stay unlocked.
- **Businesses** (free account) get clients, auto-numbering, quotes → invoices → receipts, paid/unpaid tracking. Free plan = 10 docs/month, watermarked. **Starter** ($5/month · $50/year; KES 300 / 3,000 in Kenya) removes both limits. **Pro** is shown as coming soon.
- **Any country**: the business's country (picked at sign-up, guessed from the browser) sets currency, tax name (VAT, GST, Sales tax…), tax-ID label (VAT No., GSTIN, ABN, EIN, KRA PIN…) and default rate — all editable in Settings. 36 countries in `apps/api/src/common/countries.ts` (mirrored in `apps/web/src/lib/countries.ts`).
- **Regional pricing** in `apps/api/src/billing/plans.ts` (`REGIONS`): USD by card worldwide; Kenya gets KES with M-Pesa + card. Add a region there to localise another market. The visitor's country comes from Cloudflare's `CF-IPCountry` header (so prices can't be picked freely), falling back to the browser's guess.
- Guest documents move into the account automatically on sign-up / sign-in (same browser).
- **Platform admin** (`SYSTEM_ADMIN`) sees every business, revenue, and can change plans or suspend at `/platform`.

## Stack

| | |
|---|---|
| Web | Next.js 15 (static export), Tailwind v4, Material UI for dropdowns, date pickers and the client autocomplete, TanStack Query |
| API | NestJS 11, Prisma 6 (PostgreSQL), Redis (ioredis), Puppeteer (headless Chrome) |
| Rendering | Templates are HTML/CSS in `apps/api/src/render/templates`. Chrome renders the live preview (JPEG) and the PDF **on the server**, with the watermark baked in — the browser never receives a clean file it hasn't paid for. |
| Redis | preview cache, Google OAuth state, M-Pesa token cache, rate limiting |

## Run locally

See `commands.md`. You need PostgreSQL 14+ and Redis 6+.

```bash
./create-db.sh nubian_invoices   # local dev only
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL and JWT_SECRET
cp apps/web/.env.example apps/web/.env
npm install                              # downloads Chrome for Puppeteer (~170 MB) the first time
npm run db:deploy && npm run db:seed
npm run dev                              # web http://localhost:3000 · API http://localhost:4400
```

`MPESA_MODE=mock` and `CARD_MODE=mock` (the defaults) let you test the full payment flow without keys: M-Pesa "payments" complete after ~5 s (numbers ending in `000` fail), and the card button goes to a local stand-in page.

## Google sign-in

1. console.cloud.google.com → APIs & Services → Credentials → **Create OAuth client ID** → Web application.
2. Authorised redirect URIs: `http://localhost:3000/api/auth/google/callback` (dev) and `https://tulidocs.com/api/auth/google/callback` (prod).
3. Put the ID/secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, and set `GOOGLE_REDIRECT_URI` to the matching URI.

New Google users get a business created for them and land on Settings; existing accounts with the same email are linked.

## Payments

**M-Pesa — Daraja STK Push** (`apps/api/src/payments/mpesa.service.ts`). Get an app on developer.safaricom.co.ke, test with `MPESA_MODE=sandbox`, then apply for Go-Live with your Paybill/Till and switch to `live`. The callback URL is `{API_PUBLIC_URL}/payments/mpesa/callback/{MPESA_CALLBACK_SECRET}` — it must be public HTTPS. If a callback is lost, the status poll asks Daraja (STK query) after 20 s.

**Cards — Paystack** (`apps/api/src/payments/paystack.service.ts`). Recommended to start: it onboards Kenyan companies, accepts international Visa/Mastercard, settles to a Kenyan bank or M-Pesa, and needs only a redirect + webhook. Stripe doesn't onboard Kenyan businesses directly. Global prices are charged in USD — enable USD on your Paystack account (or set the GLOBAL region's currency to KES and convert). Set `CARD_MODE=live` with `sk_test_…` first, and add the webhook `{API_PUBLIC_URL}/payments/paystack/webhook`.

When global sales grow, consider a merchant of record (Paddle or Lemon Squeezy): they handle VAT/sales tax on your subscriptions in every country and pay out to Kenya. It fits behind the same `CheckoutService` as another provider.

Checkouts are idempotent (`CheckoutService.complete`): the callback, the webhook and the status poll can all arrive and the plan/unlock is applied once.

## Tax e-invoicing (KRA eTIMS)

Kenya-only, shown only to Kenyan businesses. Placeholder only (`apps/api/src/etims/etims.service.ts` explains the OSCU steps). The schema already has the device fields on `Organization` and the signature/QR fields on `Document`, and every template prints an eTIMS block once those are filled. Settings → KRA eTIMS stores branch ID and device serial now.

## Deploy (same pattern as nubian_imports)

Server layout: repo in `/root/tulidocs`, static site in `/var/www/tulidocs`, API under pm2 as `tulidocs-api` on
**127.0.0.1:4617** (uncommon port on purpose — the server hosts several apps), nginx site `/etc/nginx/sites-available/tulidocs.com`.

**First time (once per server):**

```bash
cd /root/tulidocs && git pull
bash deploy/setup-server.sh
```

It checks port 4617 is free (`PORT=4627 bash deploy/setup-server.sh` to use another), installs Chrome's libraries for PDFs,
creates the `tulidocs` Postgres database + user, writes the production `apps/api/.env` (asks for the Google client ID/secret),
installs the nginx site + HTTPS via certbot, runs the first deploy and creates the platform admin. Safe to re-run.

**Every update after that:**

```bash
bash /root/tulidocs/deploy.sh
```

pull → `npm ci` → migrations → build API → build + swap the static site → restart pm2 → health check.

Notes
- Google Cloud → OAuth client → Authorised redirect URI: `https://tulidocs.com/api/auth/google/callback`;
  Authorised JavaScript origin: `https://tulidocs.com`.
- Payments run in **mock** mode until live keys are added; `ALLOW_MOCK_PAYMENTS=true` in `.env` lets production start that way
  (testing only — anyone can unlock for free). For launch: `MPESA_MODE=live`/`CARD_MODE=live` + keys, remove `ALLOW_MOCK_PAYMENTS`, `bash deploy.sh`.
- Keep the site behind Cloudflare (orange cloud) so `CF-IPCountry` reaches the API for regional pricing.
- Logs: `pm2 logs tulidocs-api`. Extra admin: `cd apps/api && npm run create-admin -- you@example.com 'StrongPass' "Name"`.
- Template thumbnails: after changing a template, run `npx ts-node --transpile-only scripts/template-thumbnails.ts` in `apps/api`.

## Layout

```
apps/api/src
  auth/          email + Google sign-in, JWT cookie, guest-document claim on sign-in
  guest/         no-sign-up builder (cookie-keyed), preview, PDF, unlock checkout
  documents/     quotes / invoices / receipts, payments → receipts, convert, preview/PDF
  render/        HTML templates + Puppeteer (preview JPEG, PDF), Redis preview cache
  billing/       plans & prices (plans.ts), subscribe / unlock endpoints
  payments/      M-Pesa Daraja, Paystack, idempotent checkout service, callbacks/webhooks
  organization/  business settings, logo, eTIMS details
  clients/  platform/  etims/  redis/  sequences/
apps/web/src/app
  /              landing          /create      guest builder
  /login /signup Google + email   /payment/return  card return page
  (app)/         dashboard, documents (list/new/edit/view), clients, billing, settings
  platform/      platform admin console
```
