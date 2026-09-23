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

## Apartment exterior photos

Apartment cards and apartment detail pages show a street-level photo of the building. Units at the same address share one image in `public/street-view/`. Garages, commercial, pipeline, reserved, and the residential tracker do not get these photos.

Refresh after the apartment sheet changes:

```bash
npm run streetview
```

The script skips files that are already downloaded. Pass `--force` to replace them. It geocodes with Nominatim (slowly, on purpose), then saves a Google Street View image when one is within about 80 meters. Set `GOOGLE_MAPS_API_KEY` to use the official Street View Static API. Without a key, the script still saves a real panorama thumbnail. If Street View has no nearby coverage, it saves a map pin instead. Either way the card is not left blank.

`data/street-view-manifest.json` maps each normalized address to `/street-view/<slug>.jpg`.

## What is not in v1

No sign-in, no in-app editing, and no live spreadsheet API. The pages do not add mortgages or units that are not in the JSON.
