# Grinberg Rental Room

A vacancy board for Grinberg rental inventory: apartments, commercial space, garages, and storages. It follows the browse-and-detail feel of a portfolio deal room, for rental units rather than development assemblages.

Listings, tours, rents, and office notes come from `data/rental-listings.json`. The site does not call Google Sheets.

The boards are private. A visitor who is not signed in sees a login page and no listings. Brokers sign in with email and password. Administrators manage those accounts, review sign-in history, and can require a Stripe subscription.

## Run locally

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 10 characters). Leave the Turso variables empty for local development. The app then stores accounts in `data/auth.local.db`, which is gitignored.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with the administrator email and password. That first sign-in creates the administrator account. It is not recreated if the email already exists, and changing `ADMIN_PASSWORD` later does not reset the password.

```bash
npm test
npm run build
npm start
```

## Access setup on Vercel

Production needs a hosted database. The serverless filesystem is not a durable place for accounts, so do not rely on the local SQLite file after deploy.

1. Create a free database at [Turso](https://turso.tech) (dashboard or `turso db create rental-room`).
2. Copy the database URL (`libsql://...`) and create an auth token (`turso db tokens create rental-room`).
3. In the Vercel project, set:

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL` | First administrator email. Created on first sign-in if missing. |
| `ADMIN_PASSWORD` | First administrator password, at least 10 characters. |
| `TURSO_DATABASE_URL` | Turso URL, `libsql://...`. `DATABASE_URL` is accepted as an alias. |
| `TURSO_AUTH_TOKEN` | Turso token. |
| `NEXT_PUBLIC_APP_URL` | Public origin, e.g. `https://rental-room-tau.vercel.app`, no trailing slash. |
| `STRIPE_SECRET_KEY` | Optional. See Stripe below. |
| `STRIPE_WEBHOOK_SECRET` | Optional. |
| `STRIPE_PRICE_ID` | Optional. Recurring Price ID (`price_...`). The Stripe Price must be **$100 USD per month**. The app sends this ID and does not set the amount. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional. Hosted Checkout does not require it; keep it for a future Stripe.js form. |

4. Redeploy.
5. Open the site and sign in as the administrator.
6. Open **Access desk** (`/admin`) and create a broker. New outside brokers start as **Payment required**. Copy the temporary password and send it to them. They must choose a new password before the boards open. To mark an existing broker as payment required, open their account, set **Billing status** to **Payment required**, and choose **Save profile**.
7. To turn someone off, open their account and choose **Disable account** (blocks sign-in and ends sessions) or **Force logout** (ends sessions, account stays active). **Reset password** issues a new temporary password and ends sessions.

Until `TURSO_DATABASE_URL` (or `DATABASE_URL`) is set, production shows the login page and does not serve listings.

Sign-in records the account, UTC time, IP, user agent, and a short fingerprint (SHA-256 of user agent plus `Accept-Language`, first 16 hex characters). The IP is taken from `x-vercel-forwarded-for` when Vercel sends it (clients cannot overwrite that header), then `x-real-ip`, then the first address in `x-forwarded-for`.

Sessions are random tokens in an HTTP-only, `SameSite=Lax` cookie (`rr_session`). The database stores only a SHA-256 of the token. Cookies are marked `Secure` in production. A session lasts 14 days and is checked on every request, so disable and force-logout take effect immediately. Passwords are hashed with bcrypt. Server Actions rely on Next.js Origin checks for CSRF. The Stripe webhook is authorized by its signing secret, not a cookie.

### Single-unit share links

A signed-in broker or administrator who can open the boards can send a prospect one unit.

1. Open that unit and choose **Create share link**.
2. Copy the URL and send it to the prospect. The raw link is shown once. The access database stores a SHA-256 of the token, the link id, the broker’s user id and email, the unit id, and the address label. It does not store the raw URL.
3. The prospect can open that unit — tour, floor plan, rent, and the rest of the unit page — without a broker login.
4. The same link does not open the homepage, category boards, other units, the access desk, or account pages. Those still require a broker session.
5. The link expires 14 days after it is created. **Revoke** on the unit page stops it immediately. A disabled account, or an outside broker who can no longer browse because billing lapsed, also stops that person’s links.
6. Administrators can revoke any active link on the unit. A broker can revoke only links they created.
7. Access desk lists, for each broker, the units they shared, when, and whether the link is still active. Brokers see their own links on the unit page and under Account. Opening a link adds a view and a last-opened time. Expired and revoked rows stay in that history.

The `unit_shares` table is created in the existing Turso database the first time the app connects. If the unit is later removed from the vacancy file, the link stops opening it. The address label from the day it was shared remains on the record.

### Share-risk flags

The broker list shows **Possible shared login** when any of these are true. The same text is on the access desk.

- Within 7 days, the account signed in from two or more IPs inside a 2-hour window while an earlier session was still active.
- Two sessions from different IPs overlapped in the last 7 days and both were seen within 2 hours of each other.
- That overlap happened within 30 minutes and the IPs are on different network prefixes (IPv4 first two numbers, or IPv6 first two groups). This is not a map lookup.
- Distinct IPs in 7 days are at least 4, and at least twice the median of other brokers when two or more other brokers exist.
- Distinct IPs in 30 days are at least 8, with the same peer rule.

Administrators are scored with the absolute floors (4 and 8), not against brokers. Unknown IPs are ignored.

### Stripe

Outside brokers pay **$100 USD per month** for Rental Room access. Checkout sends `line_items: [{ price: STRIPE_PRICE_ID }]`. It does not send a dollar amount. In the Stripe Dashboard, that Price must be **$100 USD, billed monthly**. Hosted Checkout tells the broker the same figure. There is no separate Stripe Customer Portal in this app.

Grinberg office accounts stay complimentary and are never billed. Creating or saving one of these emails stores an administrator with billing **Complimentary**. A webhook cannot change that status. They are not created automatically (no passwords are stored for them):

- daniel@grinbergmanagement.com
- brokeropenhouse@gmail.com (Dimitry)
- jennylanica@grinbergmanagement.com
- fatima@grinbergmanagement.com
- liliana.torija@grinbergmanagement.com
- jerika.justo@grinbergmanagement.com

Charging is optional until the keys exist. If `STRIPE_SECRET_KEY` or `STRIPE_PRICE_ID` is missing, billing status is stored but ignored and every active account can browse. Administrators can always browse.

When both are set, an outside broker can open listings only when their status is `complimentary` or `active_paid`. The other statuses are `payment_required`, `past_due`, and `canceled`. New outside brokers created on the access desk default to `payment_required`. An administrator can still choose Complimentary for a specific outside broker.

Create the $100 price in Stripe:

1. Stripe Dashboard → Product catalog → add a product for outside-broker access.
2. Add a recurring price of **$100 USD per month**. Copy the Price ID (`price_...`) into `STRIPE_PRICE_ID`.
3. Developers → API keys → copy the secret key into `STRIPE_SECRET_KEY` and the publishable key into `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. Developers → Webhooks → add an endpoint:
   `https://rental-room-tau.vercel.app/api/stripe/webhook`
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
5. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Set `NEXT_PUBLIC_APP_URL` and redeploy.
7. On an outside broker’s admin page, set billing to **Payment required** (already the default for new brokers) and choose **Generate Stripe checkout link**. Send that link. After payment, the webhook sets **Paid** and the boards open.

Use Stripe test keys until a real charge should go through. These variables still need real values before anyone is charged: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` (the $100 USD monthly Price), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL`.

## Refresh the listings

1. Replace `data/rental-listings.json` with the new snapshot.
2. Keep the same top-level shape: `source`, `contact`, and `listings`.
3. Public boards read `listings.apartments`, `listings.commercial`, `listings.garages`, and `listings.storages`. Pipeline, reserved, and residential tracker rows stay in the file for matching and are not separate pages.
4. Restart the dev server, or redeploy. The file is imported at build time.

The residential tracker is used to match apartments that already appear on the home grid. Tracker-only rows are not added as extra cards. Apartments are the residential rows from the first sheet tab (38 in the current snapshot).

`contact.applyEmail` is the apply mailto on each unit. The office phone is a call link. Dimitry’s number is plain text in the footer, not a call button.

Office notes are shown as written in the file. Edit a note in the JSON if it should not be public.

## Apartment exterior photos

Apartment cards and apartment detail pages show a street-level photo of the building. Units at the same address share one image in `public/street-view/`. Commercial, garages, storages, and the residential tracker do not get these photos.

Refresh after the apartment sheet changes:

```bash
npm run streetview
```

The script skips files that are already downloaded. Pass `--force` to replace them. It geocodes with Nominatim (slowly, on purpose), then saves a Google Street View image when one is within about 80 meters. Set `GOOGLE_MAPS_API_KEY` to use the official Street View Static API. Without a key, the script still saves a real panorama thumbnail. If Street View has no nearby coverage, it saves a map pin instead. Either way the card is not left blank.

`data/street-view-manifest.json` maps each normalized address to `/street-view/<slug>.jpg`.

Every unit detail page shows each Matterport link stored on that row. A floor plan is shown when `public/layouts/` has a PNG whose model id matches the tour URL (`m=`). Commercial and garage tours use the same rule. Units with a tour but no layout file still show the tour and omit the floor plan.

## What is not in v1

No sign-in, no in-app editing, and no live spreadsheet API. The pages do not add mortgages or units that are not in the JSON.
