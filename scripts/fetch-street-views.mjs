/**
 * Refresh apartment exterior photos.
 *
 *   npm run streetview
 *   node scripts/fetch-street-views.mjs
 *   node scripts/fetch-street-views.mjs --force
 *
 * Reads apartments in data/rental-listings.json (other categories are ignored).
 * Writes public/street-view/<slug>.jpg and data/street-view-manifest.json.
 * Several units at the same normalized address share one file.
 *
 * Existing files are left in place unless --force is passed.
 *
 * Image source, in order:
 * 1. Google Street View Static API when GOOGLE_MAPS_API_KEY (or
 *    GOOGLE_STREET_VIEW_API_KEY) is set. Metadata is checked first so a miss
 *    does not save an error image.
 * 2. Otherwise Google's public panorama search + thumbnail (no key). The
 *    camera is aimed from the nearest panorama toward the geocoded building.
 * 3. If nothing is within ~80 meters, a static map pin (OpenStreetMap tiles).
 *
 * Geocoding uses Nominatim. Requests are spaced at least 1.1s apart.
 * City and state are appended when the sheet only has a street: "Staten Island, NY".
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addressKey, streetViewSlug } from "../lib/address-key.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = resolve(root, "data/rental-listings.json");
const manifestPath = resolve(root, "data/street-view-manifest.json");
const imageDir = resolve(root, "public/street-view");
const mapScript = resolve(root, "scripts/render-map-pin.py");
const force = process.argv.includes("--force");
const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_STREET_VIEW_API_KEY || "";
const UA = "GrinbergRentalRoom/1.0 (apartment exterior refresh; contact ApplyGrinberg@gmail.com)";
const MAX_PANO_METERS = 80;
const IMAGE_WIDTH = 1024;
const IMAGE_HEIGHT = 640;

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function haversine(lat1, lon1, lat2, lon2) {
  const r = 6371000;
  const p = Math.PI / 180;
  const dLat = (lat2 - lat1) * p;
  const dLon = (lon2 - lon1) * p;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function bearing(lat1, lon1, lat2, lon2) {
  const p = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * p) * Math.cos(lat2 * p);
  const x =
    Math.cos(lat1 * p) * Math.sin(lat2 * p) -
    Math.sin(lat1 * p) * Math.cos(lat2 * p) * Math.cos((lon2 - lon1) * p);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function headingTo(fromLat, fromLon, toLat, toLon) {
  return (bearing(fromLat, fromLon, toLat, toLon) + 360) % 360;
}

function queryVariants(address, zip) {
  const city = "Staten Island, NY";
  const withZip = zip ? ` ${zip}` : "";
  const expanded = address
    .replace(/\bBaltc\b/gi, "Baltic")
    .replace(/\bAve\b/gi, "Avenue")
    .replace(/\bSt\b/gi, "Street")
    .replace(/\bPl\b/gi, "Place")
    .replace(/\bLn\b/gi, "Lane")
    .replace(/\bCt\b/gi, "Court");
  const withoutLetter = address.replace(/^(\d+)[A-Za-z]\b/, "$1");
  const queries = [
    `${address}, ${city}${withZip}`,
    `${address}, ${city}`,
    `${expanded}, ${city}${withZip}`,
    `${expanded}, ${city}`,
    `${withoutLetter}, ${city}${withZip}`,
    `${withoutLetter.replace(/\bPl\b/gi, "Place")}, ${city}`,
  ];
  return [...new Set(queries.map((query) => query.replace(/\s+/g, " ").trim()))];
}

async function geocode(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "us");
  const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status} for ${query}`);
  const rows = await response.json();
  const hit = rows[0];
  if (!hit) return null;
  const label = String(hit.display_name ?? "");
  if (!/staten island|richmond county/i.test(label)) return null;
  return { lat: Number(hit.lat), lon: Number(hit.lon), label, query };
}

function parsePano(body) {
  const id = body.match(/\[2,"([A-Za-z0-9_-]{8,})"\]/);
  const loc = body.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
  if (!id || !loc) return null;
  return { panoid: id[1], lat: Number(loc[1]), lon: Number(loc[2]) };
}

async function findPano(lat, lon) {
  for (const radius of [50, 80]) {
    const url =
      "https://maps.googleapis.com/maps/api/js/GeoPhotoService.SingleImageSearch?pb=" +
      `!1m5!1sapiv3!5sUS!11m2!1m1!1b0!2m4!1m2!3d${lat}!4d${lon}!2d${radius}` +
      "!3m10!2m2!1sen!2sUS!9m1!1e2!11m4!1m3!1e2!2b1!3e2!4m10!1e1!1e2!1e3!1e4!1e8!1e6!5m1!1e2!6m1!1e2" +
      "&callback=_xdc_._cb";
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await response.text();
    const pano = parsePano(text);
    if (!pano) continue;
    const distanceMeters = haversine(lat, lon, pano.lat, pano.lon);
    if (distanceMeters <= MAX_PANO_METERS) {
      return { ...pano, distanceMeters, heading: headingTo(pano.lat, pano.lon, lat, lon) };
    }
    await sleep(350);
  }
  return null;
}

function isJpeg(buffer) {
  return buffer.length > 8000 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

async function download(url) {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "image/jpeg,image/*,*/*" } });
  const buffer = Buffer.from(await response.arrayBuffer());
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("image") || !isJpeg(buffer)) {
    throw new Error(`image download failed HTTP ${response.status} ${type} ${buffer.length} bytes`);
  }
  return buffer;
}

async function streetViewFromKey(lat, lon) {
  const metaUrl = new URL("https://maps.googleapis.com/maps/api/streetview/metadata");
  metaUrl.searchParams.set("location", `${lat},${lon}`);
  metaUrl.searchParams.set("source", "outdoor");
  metaUrl.searchParams.set("radius", String(MAX_PANO_METERS));
  metaUrl.searchParams.set("key", apiKey);
  const metaRes = await fetch(metaUrl);
  const meta = await metaRes.json();
  if (meta.status !== "OK" || !meta.location) return null;
  const panoLat = Number(meta.location.lat);
  const panoLon = Number(meta.location.lng);
  const distanceMeters = haversine(lat, lon, panoLat, panoLon);
  if (distanceMeters > MAX_PANO_METERS) return null;
  const heading = headingTo(panoLat, panoLon, lat, lon);
  const imageUrl = new URL("https://maps.googleapis.com/maps/api/streetview");
  imageUrl.searchParams.set("size", `${IMAGE_WIDTH}x${IMAGE_HEIGHT}`);
  imageUrl.searchParams.set("location", `${panoLat},${panoLon}`);
  imageUrl.searchParams.set("fov", "80");
  imageUrl.searchParams.set("heading", heading.toFixed(2));
  imageUrl.searchParams.set("pitch", "8");
  imageUrl.searchParams.set("source", "outdoor");
  imageUrl.searchParams.set("return_error_code", "true");
  imageUrl.searchParams.set("key", apiKey);
  const buffer = await download(imageUrl);
  return {
    buffer,
    kind: "streetview",
    panoid: meta.pano_id ?? null,
    distanceMeters,
    heading,
    credit: "Building exterior · © Google",
  };
}

async function streetViewFromPano(lat, lon) {
  const pano = await findPano(lat, lon);
  if (!pano) return null;
  const url = new URL("https://streetviewpixels-pa.googleapis.com/v1/thumbnail");
  url.searchParams.set("panoid", pano.panoid);
  url.searchParams.set("cb_client", "maps_sv.tactile.gps");
  url.searchParams.set("w", String(IMAGE_WIDTH));
  url.searchParams.set("h", String(IMAGE_HEIGHT));
  url.searchParams.set("yaw", pano.heading.toFixed(2));
  url.searchParams.set("pitch", "8");
  url.searchParams.set("thumbfov", "80");
  const buffer = await download(url);
  return {
    buffer,
    kind: "streetview",
    panoid: pano.panoid,
    distanceMeters: pano.distanceMeters,
    heading: pano.heading,
    credit: "Building exterior · © Google",
  };
}

function renderMap(lat, lon, dest) {
  const result = spawnSync("python3", [mapScript, String(lat), String(lon), dest], {
    encoding: "utf8",
    timeout: 120000,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "map render failed");
  }
  const buffer = readFileSync(dest);
  if (!isJpeg(buffer)) throw new Error("map render did not write a jpeg");
  return buffer;
}

function writeJpeg(dest, buffer) {
  const tmp = `${dest}.partial`;
  writeFileSync(tmp, buffer);
  renameSync(tmp, dest);
}

function loadManifest() {
  if (!existsSync(manifestPath)) return { photos: {} };
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return { photos: {} };
  }
}

function saveManifest(photos) {
  const ordered = Object.fromEntries(
    [...photos.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  );
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: "Apartment exteriors only, keyed by the normalized address. Refresh with npm run streetview.",
        photos: ordered,
      },
      null,
      2,
    )}\n`,
  );
}

function uniqueApartments(data) {
  const rows = new Map();
  for (const listing of data.listings.apartments) {
    const key = addressKey(listing.address);
    const current = rows.get(key);
    if (!current) {
      rows.set(key, { key, address: listing.address, zip: listing.zip ?? null });
    } else if (!current.zip && listing.zip) {
      current.zip = listing.zip;
    }
  }
  return [...rows.values()].sort((a, b) => a.address.localeCompare(b.address));
}

async function locate(address, zip) {
  for (const query of queryVariants(address, zip)) {
    const hit = await geocode(query);
    await sleep(1100);
    if (hit) return hit;
  }
  return null;
}

async function main() {
  mkdirSync(imageDir, { recursive: true });
  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  const addresses = uniqueApartments(data);
  const previous = loadManifest();
  const photos = new Map(Object.entries(previous.photos ?? {}));
  const failures = [];
  console.log(
    `${addresses.length} unique apartment addresses. ${apiKey ? "Using Street View Static API." : "No API key; using panorama thumbnails."}`,
  );

  for (const row of addresses) {
    const slug = streetViewSlug(row.address);
    const dest = resolve(imageDir, `${slug}.jpg`);
    const src = `/street-view/${slug}.jpg`;
    const prior = photos.get(row.key);
    if (!force && prior?.src === src && existsSync(dest) && statSync(dest).size > 8000) {
      console.log(`skip ${row.address}`);
      continue;
    }

    process.stdout.write(`fetch ${row.address} ... `);
    try {
      const place = await locate(row.address, row.zip);
      if (!place) throw new Error("geocoder returned no Staten Island match");
      let shot = null;
      if (apiKey) shot = await streetViewFromKey(place.lat, place.lon);
      if (!shot) shot = await streetViewFromPano(place.lat, place.lon);
      let kind = "streetview";
      let credit = "Building exterior · © Google";
      let extra = {};
      if (shot) {
        writeJpeg(dest, shot.buffer);
        kind = shot.kind;
        credit = shot.credit;
        extra = {
          panoid: shot.panoid,
          distanceMeters: Math.round(shot.distanceMeters),
          heading: Math.round(shot.heading),
        };
      } else {
        renderMap(place.lat, place.lon, dest);
        kind = "map";
        credit = "Location map · © OpenStreetMap";
      }
      const alt =
        kind === "streetview"
          ? `Street-level exterior of ${row.address}, Staten Island`
          : `Map showing ${row.address}, Staten Island`;
      photos.set(row.key, {
        src,
        kind,
        alt,
        credit,
        address: row.address,
        zip: row.zip,
        query: place.query,
        lat: place.lat,
        lon: place.lon,
        ...extra,
      });
      saveManifest(photos);
      console.log(`${kind}${extra.distanceMeters != null ? ` ${extra.distanceMeters}m` : ""}`);
      await sleep(400);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${row.address}: ${message}`);
      console.log(`FAILED ${message}`);
    }
  }

  saveManifest(photos);
  const missing = addresses.filter((row) => !photos.get(row.key)?.src || !existsSync(resolve(imageDir, `${streetViewSlug(row.address)}.jpg`)));
  console.log(`\n${addresses.length - missing.length}/${addresses.length} addresses have an image.`);
  if (failures.length || missing.length) {
    console.error("Failures:");
    for (const line of failures) console.error(`- ${line}`);
    for (const row of missing) {
      if (!failures.some((line) => line.startsWith(row.address))) console.error(`- ${row.address}: no image file`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
