/**
 * Sync data/rental-listings.json (listings.apartments) to the office Google Sheet
 * "Available Apartments Broker list" -> tab "Available Apartments".
 *
 *   node scripts/sync-from-sheet.mjs path/to/available-apartments.csv [--dry-run]
 *
 * Daily check (run by the office bot, or by hand):
 *   1. Export the "Available Apartments" tab as CSV (Google Drive/Sheets connector,
 *      or File > Download > CSV). The sheet is not public, so this script does not fetch it.
 *   2. Run this script. It prints REMOVED / ADDED / UPDATED units.
 *   3. If new addresses were added, run `npm run streetview` for exterior photos.
 *   4. `npm test && npm run build`, open a PR to main, deploy to production.
 *
 * Rules:
 * - Only the APARTMENTS block (rows before the "GARAGES" header) is read.
 * - Units on the site but not on the sheet are removed from listings.apartments.
 * - listings.reserved and Turso data (claims, completed rentals) are never touched.
 * - Existing units keep their id, address spelling, bedrooms/baths/notes/prospect.
 *   Sheet fields (type, rents, zip, status, flags, tour, office notes) are refreshed.
 * - Tour URL comes from the second "Virtual Tour Links" column (column N).
 * - A sheet status containing "Application" (e.g. "Application In Process (not yet
 *   approved)") is written as "Application In Process". The site keeps it in the
 *   broker-visible Available section with an "Application In Process" badge, even
 *   if the unit also appears on the sheet's "Reserved Apartments" tab. Do not move
 *   such a unit into listings.reserved; the script warns if one is already there.
 * - Sqft/layout mappings live in data/layout-sqft.json and data/floor-plans.json
 *   keyed by Matterport id, and are not edited here.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addressKey, unitKey } from "../lib/address-key.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = resolve(root, "data/rental-listings.json");
const csvPath = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!csvPath) {
  console.error("usage: node scripts/sync-from-sheet.mjs <csv> [--dry-run]");
  process.exit(1);
}

// Known sheet typos -> address spelling used on the site.
const ADDRESS_ALIASES = { "9 baltc avenue": "9 baltic avenue" };
const UNIT_FIXES = [[/^Uni t\s*(\w+)$/i, "Unit $1"]];

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const APPLICATION_IN_PROCESS = "Application In Process";
const normalizeStatus = (v) => (v && /\bapplication\b/i.test(v) ? APPLICATION_IN_PROCESS : v);
const clean = (v) => { const s = (v ?? "").replace(/\s+/g, " ").trim(); return s === "" ? null : s; };
const money = (v) => { const s = clean(v); if (!s) return null; const n = Number(s.replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const keyOf = (address, unit) => {
  const a = addressKey(address);
  return `${ADDRESS_ALIASES[a] ?? a}|${unitKey(unit)}`;
};

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const headerIdx = rows.findIndex((r) => clean(r[1]) === "Property" && clean(r[2]) === "Unit");
if (headerIdx < 0) throw new Error("Could not find the Property/Unit header row");
const sheet = [];
for (const r of rows.slice(headerIdx + 1)) {
  const first = clean(r[1]);
  if (first && /^(GARAGES|COMMERCIAL|STORAGE)/i.test(first)) break;
  if (!first || !clean(r[2])) continue;
  let unit = clean(r[2]);
  for (const [re, rep] of UNIT_FIXES) unit = unit.replace(re, rep);
  const tour = clean(r[13])?.split(" ")[0] ?? null;
  sheet.push({
    address: first, unit,
    unitType: clean(r[3]), minRent: money(r[4]), targetRent: money(r[5]), zip: clean(r[6]),
    status: normalizeStatus(clean(r[7])), nycha: clean(r[8]), hpdTrustFund: clean(r[9]),
    utilitiesIncluded: clean(r[10]), washerDryer: clean(r[11]), tourReady: clean(r[12]),
    tourUrl: tour && /^https?:/.test(tour) ? tour : null, officeNotes: clean(r[14]),
  });
}

const data = JSON.parse(readFileSync(dataPath, "utf8"));
const current = data.listings.apartments;
const byKey = new Map(current.map((l) => [keyOf(l.address, l.unit), l]));
const sheetKeys = new Set();
const next = [], added = [], updated = [];
for (const s of sheet) {
  const k = keyOf(s.address, s.unit);
  if (sheetKeys.has(k)) continue;
  sheetKeys.add(k);
  const old = byKey.get(k);
  const fields = {
    unitType: s.unitType, minRent: s.minRent, targetRent: s.targetRent, zip: s.zip ?? old?.zip ?? null,
    status: s.status, nycha: s.nycha, hpdTrustFund: s.hpdTrustFund, utilitiesIncluded: s.utilitiesIncluded,
    washerDryer: s.washerDryer, tourReady: s.tourReady, officeNotes: s.officeNotes,
  };
  if (old) {
    const tours = s.tourUrl
      ? [old.tours?.find((t) => t.url === s.tourUrl) ?? { url: s.tourUrl, label: null }]
      : old.tours ?? [];
    const merged = { ...old, ...fields, tours };
    if (JSON.stringify(merged) !== JSON.stringify(old)) updated.push(`${old.address} ${old.unit}`);
    next.push(merged);
  } else {
    const l = {
      id: `apt-${slug(s.address)}-${slug(s.unit)}`, category: "apartment", address: s.address, unit: s.unit,
      ...fields, potentialRent: null, tours: s.tourUrl ? [{ url: s.tourUrl, label: null }] : [],
      reservationDate: null, daysSinceReservation: null, bedrooms: null, baths: null, prospect: null, notes: null,
    };
    added.push(`${l.address} ${l.unit}`);
    next.push(l);
  }
}
const removed = current.filter((l) => !sheetKeys.has(keyOf(l.address, l.unit))).map((l) => `${l.address} ${l.unit} (${l.id})`);

const reservedKeys = new Map((data.listings.reserved ?? []).map((l) => [keyOf(l.address, l.unit), l]));
const reservedIdSet = new Set((data.listings.reserved ?? []).map((l) => l.id));
const applicationConflicts = next
  .filter((l) => l.status === APPLICATION_IN_PROCESS)
  .filter((l) => reservedIdSet.has(l.id) || reservedKeys.has(keyOf(l.address, l.unit)))
  .map((l) => `${l.address} ${l.unit} (${l.id})`);

console.log(`Sheet apartments: ${sheet.length}`);
console.log(`REMOVED (${removed.length}):`); removed.forEach((x) => console.log("  - " + x));
console.log(`ADDED (${added.length}):`); added.forEach((x) => console.log("  + " + x));
console.log(`UPDATED (${updated.length}):`); updated.forEach((x) => console.log("  ~ " + x));
const applications = next.filter((l) => l.status === APPLICATION_IN_PROCESS).map((l) => `${l.address} ${l.unit}`);
console.log(`APPLICATION IN PROCESS, broker-visible (${applications.length}):`); applications.forEach((x) => console.log("  * " + x));
if (applicationConflicts.length) {
  console.log(`WARNING: Application In Process units also in listings.reserved (they would stay hidden). Remove them from listings.reserved:`);
  applicationConflicts.forEach((x) => console.log("  ! " + x));
}

if (!dryRun) {
  data.listings.apartments = next;
  data.source.snapshotDate = new Date().toISOString().slice(0, 10);
  writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
  console.log("Wrote data/rental-listings.json");
}
