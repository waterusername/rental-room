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
 * - Columns are matched by header name, not by position or letter. The current
 *   Available tab starts at Property (the old duplicate Virtual Tour Links column
 *   was removed, so Virtual Tour Links is now column M). Sqft is ignored here.
 *   If Virtual Tour Links appears more than once, the later column is the tour link.
 * - Units on the site but not on the sheet are removed from listings.apartments.
 * - listings.reserved and Turso data (claims, completed rentals) are never touched.
 *   The site does not render listings.reserved. Do not copy the Reserved Apartments
 *   tab into listings.apartments or listings.reserved.
 * - Existing units keep their id, address spelling, bedrooms/baths/notes/prospect.
 *   Sheet fields (type, rents, zip, status, flags, tour, office notes) are refreshed.
 * - A sheet row with no Matterport URL in Virtual Tour Links is stored with no
 *   tour. The board then shows it in Coming Up, below Available, whatever the
 *   status cell says. A later sync that includes a Matterport link moves it back
 *   to Available unless the status is turnover. An empty tour cell clears a
 *   previously saved tour.
 * - A sheet status containing "Application" (e.g. "Application In Process (not yet
 *   approved)") is written as "Application In Process". With a Matterport tour it
 *   stays in Available with an "Application In Process" badge, even if the unit is
 *   also on the Reserved Apartments tab or already in listings.reserved. Without
 *   a tour it is Coming Up.
 * - Reserve, Reserved, Reservation, and Turnover-reserved (any wording with
 *   reserve/reserved/reservation, unless it also says application) are omitted.
 *   Those rows are not written into listings.apartments and are not shown.
 * - Sqft/layout mappings live in data/layout-sqft.json and data/floor-plans.json
 *   keyed by Matterport id, and are not edited here.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addressKey, unitKey } from "../lib/address-key.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = resolve(root, "data/rental-listings.json");

// Known sheet typos -> address spelling used on the site.
const ADDRESS_ALIASES = { "9 baltc avenue": "9 baltic avenue" };
const UNIT_FIXES = [[/^Uni t\s*(\w+)$/i, "Unit $1"]];

const APPLICATION_IN_PROCESS = "Application In Process";
const isApplication = (v) => Boolean(v && /\bapplication\b/i.test(v));
const normalizeStatus = (v) => (isApplication(v) ? APPLICATION_IN_PROCESS : v);
/** Same reserved rule as lib/board.ts. Application In Process is not reserved. */
function isReservedSheetStatus(v) {
  if (!v || isApplication(v)) return false;
  const value = v
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/[.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /\breserv(?:e|ed|ation)\b/.test(value);
}
const clean = (v) => { const s = (v ?? "").replace(/\s+/g, " ").trim(); return s === "" ? null : s; };
const money = (v) => { const s = clean(v); if (!s) return null; const n = Number(s.replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const keyOf = (address, unit) => {
  const a = addressKey(address);
  return `${ADDRESS_ALIASES[a] ?? a}|${unitKey(unit)}`;
};

/** Header text used to find a column. Order is not a position. */
const SHEET_COLUMNS = [
  ["property", ["property"]],
  ["unit", ["unit"]],
  ["unitType", ["unit type"]],
  ["minRent", ["min rent"]],
  ["targetRent", ["target rent"]],
  ["zip", ["zip"]],
  ["status", ["status"]],
  ["nycha", ["nycha"]],
  ["hpdTrustFund", ["hpd/trustfund", "hpd/trust fund"]],
  ["utilitiesIncluded", ["utilities included"]],
  ["washerDryer", ["washer/dryer", "washer dryer"]],
  ["tourReady", ["vt ready", "tour ready"]],
  ["tourUrl", ["virtual tour links", "virtual tour link"]],
  ["officeNotes", ["office notes"]],
];

export function headerKey(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, "/");
}

export function parseCsv(text) {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (q) {
      if (c === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Last matching header wins, so a leftover Virtual Tour Links column is ignored. */
export function sheetColumns(headerRow) {
  const keyed = headerRow.map((cell, index) => ({ key: headerKey(cell), index }));
  const columns = {};
  const missing = [];
  for (const [name, aliases] of SHEET_COLUMNS) {
    const hits = keyed.filter((cell) => aliases.includes(cell.key));
    if (!hits.length) {
      missing.push(aliases[0]);
      continue;
    }
    columns[name] = hits[hits.length - 1].index;
  }
  if (missing.length) {
    const found = headerRow.map((cell) => clean(cell)).filter(Boolean).join(", ");
    throw new Error(`Missing sheet column ${missing.map((name) => `"${name}"`).join(", ")}. Found headers: ${found}`);
  }
  return columns;
}

function findHeader(rows) {
  for (let i = 0; i < rows.length; i++) {
    const keys = new Set(rows[i].map((cell) => headerKey(cell)));
    if (!keys.has("property") || !keys.has("unit")) continue;
    return { index: i, columns: sheetColumns(rows[i]) };
  }
  throw new Error("Could not find the Property/Unit header row");
}

function cell(row, columns, name) {
  return row[columns[name]];
}

/**
 * Apartments from an Available Apartments CSV. Columns are found by header name.
 * Reserved and turnover-reserved rows are omitted. Sqft is not returned.
 */
export function readAvailableApartments(csvText) {
  const rows = parseCsv(csvText);
  const { index, columns } = findHeader(rows);
  const apartments = [];
  const omittedReserved = [];
  for (const r of rows.slice(index + 1)) {
    const first = clean(cell(r, columns, "property"));
    if (first && /^(GARAGES|COMMERCIAL|STORAGE)/i.test(first)) break;
    if (!first || !clean(cell(r, columns, "unit"))) continue;
    let unit = clean(cell(r, columns, "unit"));
    for (const [re, rep] of UNIT_FIXES) unit = unit.replace(re, rep);
    const status = normalizeStatus(clean(cell(r, columns, "status")));
    if (isReservedSheetStatus(status)) {
      omittedReserved.push(`${first} ${unit} (${status})`);
      continue;
    }
    const tour = clean(cell(r, columns, "tourUrl"))?.split(" ")[0] ?? null;
    apartments.push({
      address: first,
      unit,
      unitType: clean(cell(r, columns, "unitType")),
      minRent: money(cell(r, columns, "minRent")),
      targetRent: money(cell(r, columns, "targetRent")),
      zip: clean(cell(r, columns, "zip")),
      status,
      nycha: clean(cell(r, columns, "nycha")),
      hpdTrustFund: clean(cell(r, columns, "hpdTrustFund")),
      utilitiesIncluded: clean(cell(r, columns, "utilitiesIncluded")),
      washerDryer: clean(cell(r, columns, "washerDryer")),
      tourReady: clean(cell(r, columns, "tourReady")),
      tourUrl: tour && /^https?:/.test(tour) ? tour : null,
      officeNotes: clean(cell(r, columns, "officeNotes")),
    });
  }
  return { apartments, omittedReserved };
}

function syncFromCsv(csvPath, { dryRun }) {
  const { apartments: sheet, omittedReserved } = readAvailableApartments(readFileSync(csvPath, "utf8"));
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
        : [];
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
  console.log(`OMITTED RESERVED, not shown (${omittedReserved.length}):`); omittedReserved.forEach((x) => console.log("  - " + x));
  console.log(`REMOVED (${removed.length}):`); removed.forEach((x) => console.log("  - " + x));
  console.log(`ADDED (${added.length}):`); added.forEach((x) => console.log("  + " + x));
  console.log(`UPDATED (${updated.length}):`); updated.forEach((x) => console.log("  ~ " + x));
  const applications = next.filter((l) => l.status === APPLICATION_IN_PROCESS).map((l) => `${l.address} ${l.unit}`);
  console.log(`APPLICATION IN PROCESS, broker-visible (${applications.length}):`); applications.forEach((x) => console.log("  * " + x));
  const noTour = next
    .filter((l) => !(l.tours ?? []).some((tour) => /matterport\.com/i.test(tour?.url ?? "")))
    .map((l) => `${l.address} ${l.unit}`);
  console.log(`COMING UP, no Matterport tour (${noTour.length}):`); noTour.forEach((x) => console.log("  * " + x));
  if (applicationConflicts.length) {
    console.log(`NOTE: Application In Process units are also in listings.reserved. The site still shows them; listings.reserved is not rendered:`);
    applicationConflicts.forEach((x) => console.log("  * " + x));
  }

  if (!dryRun) {
    data.listings.apartments = next;
    data.source.snapshotDate = new Date().toISOString().slice(0, 10);
    writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
    console.log("Wrote data/rental-listings.json");
  }
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const csvPath = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!csvPath || csvPath === "--dry-run") {
    console.error("usage: node scripts/sync-from-sheet.mjs <csv> [--dry-run]");
    process.exit(1);
  }
  syncFromCsv(csvPath, { dryRun });
}
