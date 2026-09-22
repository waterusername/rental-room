# Grinberg Rental Room

A vacancy board for Grinberg rental inventory: apartments, garages and storage, commercial space, pipeline units, and reservations. It follows the browse-and-detail feel of a portfolio deal room, for rental units rather than development assemblages.

Listings, tours, rents, and office notes come from `data/rental-listings.json`. The site does not call Google Sheets.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build
npm start
```

Deploy on Vercel as a Next.js app. No environment variables are required.

## Refresh the listings

1. Replace `data/rental-listings.json` with the new snapshot.
2. Keep the same top-level shape: `source`, `contact`, and `listings`.
3. `listings` has `apartments`, `garagesStorage`, `commercial`, `pipeline`, `reserved`, and `residentialTracker`.
4. Restart the dev server, or redeploy. The file is imported at build time.

The residential tracker is used to match apartments that already appear on the home grid. Tracker-only rows are not added as extra cards.

`contact.applyEmail` and `contact.phones` are the apply mailto and phone links on each unit.

Office notes are shown as written in the file. Edit a note in the JSON if it should not be public.

## What is not in v1

No sign-in, no in-app editing, and no live spreadsheet API. The pages do not add mortgages, photos, or units that are not in the JSON.
