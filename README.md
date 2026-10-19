# Grinberg Rental Room

A vacancy board for Grinberg apartments. It follows the browse-and-detail feel of a portfolio deal room, for rental units rather than development assemblages.

Listings, tours, rents, and office notes come from `data/rental-listings.json`. The site does not call Google Sheets. Apartment `status` in that file selects the board section: Available or Coming Up (turnover). Reserve, Reserved, and Turnover-reserved units, and every row in `listings.reserved`, stay in the file and are not shown to brokers or administrators.

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
| `OFFICE_NOTIFY_EMAILS` | Optional. Comma-separated office addresses for broker claim emails. When empty, the Grinberg office list in `lib/auth/config.ts` is used. `daniel@grinbergmanagement.com` is always included. |
| `RESEND_API_KEY` | Optional. Resend API key. Both this and `MAIL_FROM` must be set before a claim email is sent. The claim is saved either way. |
| `MAIL_FROM` | Optional. From address Resend will accept, for example `Grinberg Rental Room <office@your-verified-domain>`. |

4. Redeploy.
5. Open the site and sign in as the administrator.
6. Open **Access desk** (`/admin`) and create a broker. New outside brokers start as **Payment required**. Copy the temporary password and send it to them. They must choose a new password before the boards open. To mark an existing broker as payment required, open their account, set **Billing status** to **Payment required**, and choose **Save profile**.

Outside brokers can also open **Broker sign up** on the sign-in page (`/signup`). That form collects name, email, phone, optional brokerage, a password they choose, and acceptance of the broker terms (the acceptance time is stored). It always creates an outside broker with billing **Payment required** and does not set a temporary password. It never creates an administrator or a complimentary account, including for `@grinbergmanagement.com` addresses. Grinberg staff stay admin-created and free. When Stripe is configured, sign-up signs them in and sends them to the existing Checkout session (`STRIPE_PRICE_ID`, $100 USD per month). When Stripe is not configured, an active account can open the boards. The access desk marks these rows **Self sign-up**.
7. To turn someone off, open their account and choose **Disable account** (blocks sign-in and ends sessions) or **Force logout** (ends sessions, account stays active). **Reset password** issues a new temporary password and ends sessions.

Until `TURSO_DATABASE_URL` (or `DATABASE_URL`) is set, production shows the login page and does not serve listings.

Sign-in records the account, UTC time, IP, user agent, and a short fingerprint (SHA-256 of user agent plus `Accept-Language`, first 16 hex characters). The IP is taken from `x-vercel-forwarded-for` when Vercel sends it (clients cannot overwrite that header), then `x-real-ip`, then the first address in `x-forwarded-for`.

Sessions are random tokens in an HTTP-only, `SameSite=Lax` cookie (`rr_session`). The database stores only a SHA-256 of the token. Cookies are marked `Secure` in production. A session lasts 14 days and is checked on every request, so disable and force-logout take effect immediately. Passwords are hashed with bcrypt. Server Actions rely on Next.js Origin checks for CSRF. The Stripe webhook is authorized by its signing secret, not a cookie.

### Single-unit share links

A signed-in broker or administrator who can open the boards can send a prospect one unit.

1. Open that unit and choose **Create share link**.
2. Copy the URL and send it to the prospect. The raw link is shown once. The access database stores a SHA-256 of the token, the link id, the broker’s user id and email, the unit id, and the address label. It does not store the raw URL.
3. The prospect can open that unit — tour, floor plan, rent, and the rest of the unit page — without a broker login. Reserved units are not shareable. Creating a link is refused, and a link created earlier stops opening the unit once it is reserved.
4. The same link does not open the homepage, category boards, other units, the access desk, or account pages. Those still require a broker session.
5. Every link expires 1 day (24 hours) after it is created. A disabled account, or an outside broker who can no longer browse because billing lapsed, also stops that person’s links. An expired or revoked link shows that it is closed and does not show the unit.
6. Only an administrator can revoke a link, from that broker’s page on the access desk. Brokers do not see share history on the unit page or under Account.
7. Access desk lists, for each broker, the units they shared, with created, expires, revoked, status (active, expired, or revoked), and views. Opening a link adds a view and a last-opened time. Expired and revoked rows stay in that history.

The `unit_shares` table is created in the existing Turso database the first time the app connects. If the unit is later removed from the vacancy file, the link stops opening it. The address label from the day it was shared remains on the record.

### Broker claims

A signed-in broker who can open the boards can mark an Available or Coming Up apartment Reserved when they are working that deal.

1. On the apartment board, choose **Mark reserved** on the card, or open the unit and choose **Mark reserved**. An optional note (up to 280 characters) can go with the unit-page form. The broker’s name and email come from the session.
2. The unit leaves the site for brokers and administrators. Nobody can open it or create a share link, and an existing share link stops opening it. There is no Reserved section, Reserved count, or Reserved nav item.
3. The claim is a row in `unit_claims` (created on the existing Turso database the first time the app connects). It is not written into `data/rental-listings.json`. Replacing that file does not clear claims. A claim for a unit id that is no longer in the file stays in the database and the unit stays off the site.

The office email is sent only when `RESEND_API_KEY` and `MAIL_FROM` are both set. The message goes to `OFFICE_NOTIFY_EMAILS` when that list is set, otherwise to every address in the Grinberg office list (`GRINBERG_ADMIN_EMAILS` in `lib/auth/config.ts`). `daniel@grinbergmanagement.com` is always included. There is no SMTP password in this app. Until the Resend variables are set, the claim is still saved and the unit stays off the site, and the office email is not sent.

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
- garygrinberg@grinbergmanagement.com

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
3. Apartment `status` selects the section. Matching is case-insensitive and treats `Turn Over` and `Turnover` as the same word.
   - `Available` → **Available**, shown to brokers and administrators.
   - `Turnover In Progress`, `Turn Over In Progress`, or other turnover wording that does not also say reserved → **Coming Up**. The board does not use the raw sheet phrase as the section title. Brokers and administrators both see it.
   - `Reserve`, `Reserved`, `RESERVED`, `Reservation`, or `Turnover-reserved` (any wording with reserve, reserved, or reservation) → not shown. Brokers and administrators do not see these units on the board, in counts, in nav, or on a unit page, and cannot create a share link. An existing share link stops opening the unit. There is no Reserved section.
   - `Application In Process` stays in **Available** with that badge, even when the same text also matches reserved or the unit is listed in `listings.reserved`.
   - A broker can also mark an Available or Coming Up unit Reserved from the unit page or the card. That claim is stored in Turso (`unit_claims`), not written back into this JSON file. The unit leaves the site for every role.
   - Any other status (for example credit check, under initial development, or a blank status) stays in **Available**. The card keeps that sheet wording.
4. A row in `listings.reserved` is not rendered, even if its status text is different or the same unit also remains in `listings.apartments`. Application In Process is the exception and stays visible. `listings.commercial`, `listings.garages`, `listings.storages`, `listings.pipeline`, and `listings.residentialTracker` stay in the file so the shape is stable. Those tabs are not pages.
5. Restart the dev server, or redeploy. The file is imported at build time.

Rows from other tabs are not added as cards. The current snapshot has 35 apartments. Reserved rows stay in `listings.reserved` and are not shown.

`contact.applyEmail` is the apply mailto on each unit. The office phone is a call link. Dimitry’s number is plain text in the footer, not a call button.

Office notes are shown as written in the file. Edit a note in the JSON if it should not be public.

## Daily sync from the office sheet

The source is the "Available Apartments" tab of the office Google Sheet (Available Apartments Broker list). Once a day:

1. Export that tab as CSV (Sheets connector or File > Download > CSV).
2. `node scripts/sync-from-sheet.mjs path/to.csv --dry-run` to preview, then without `--dry-run` to write.
   Columns are matched by header name, not by letter. The current Available tab is Property, Unit, Unit Type, Min Rent, Target Rent, Zip, Status, NYCHA, HPD/TrustFund, Utilities Included, Washer/Dryer, VT READY, Virtual Tour Links, Office Notes, Sqft. Virtual Tour Links (column M, after the old duplicate column A was removed) is the tour URL. If that header appears twice, the later column is used. Sqft on the sheet is ignored; square footage still comes from the Matterport layout files.
   Units not on the sheet are removed from `listings.apartments`; new rows are added; existing rows keep id, layout, sqft, and tour labels. `listings.reserved` and Turso claims / completed rentals are untouched, and `listings.reserved` is not rendered.
   Do not copy the sheet's "Reserved Apartments" tab into `listings.apartments` or `listings.reserved`. A unit that leaves the Available tab for that Reserved tab is removed from `listings.apartments` and does not come back onto the site.
   Rows on the Available tab whose status says Reserve, Reserved, Reservation, or Turnover-reserved are omitted from `listings.apartments` and are not shown. The script prints them as `OMITTED RESERVED, not shown`.
   A unit whose status on the Available tab says "Application In Process" (for example "Application In Process (not yet approved)") is written as status `Application In Process`. It stays in the Available section with a tan "Application In Process" badge (same chip style as Coming Up), even if the unit is also listed on the "Reserved Apartments" tab or already in `listings.reserved`. Do not mark it `RESERVED`. Once the application is approved and the sheet says Reserved, the sync omits it and the site stops showing it.
3. If addresses were added, `npm run streetview`.
4. Test, build, PR to `main`, deploy to production.

## Apartment exterior photos

Apartment cards and apartment detail pages show a street-level photo of the building. Units at the same address share one image in `public/street-view/`.

Refresh after the apartment sheet changes:

```bash
npm run streetview
```

The script skips files that are already downloaded. Pass `--force` to replace them. It geocodes with Nominatim (slowly, on purpose), then saves a Google Street View image when one is within about 80 meters. Set `GOOGLE_MAPS_API_KEY` to use the official Street View Static API. Without a key, the script still saves a real panorama thumbnail. If Street View has no nearby coverage, it saves a map pin instead. Either way the card is not left blank.

`data/street-view-manifest.json` maps each normalized address to `/street-view/<slug>.jpg`.

A single unit can use its own photo instead. `data/listing-exteriors.json` maps that listing id to an image in `public/exteriors/`. The card and the detail page use that file and do not fall back to Street View. Other units at the same address still use the shared photo. `npm run streetview` does not replace these files.

Every unit detail page shows each Matterport link stored on that apartment. A floor plan is shown when `public/layouts/` has a PNG whose model id matches the tour URL (`m=`). Units with a tour but no layout file still show the tour and omit the floor plan.

## What is not in v1

No sign-in, no in-app editing, and no live spreadsheet API. The pages do not add mortgages or units that are not in the JSON.
