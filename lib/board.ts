import { bedCount, statusLabel } from "./format";
import type { Listing } from "./types";

/**
 * Apartment board sections follow the Available Apartments Broker sheet.
 * The site does not read that sheet live. Each unit's `status` in
 * data/rental-listings.json is the source of truth (see README, "Refresh the listings").
 *
 * - Available → Available, shown to brokers and administrators
 * - No Matterport tour → Coming Up, whatever the sheet status says. Adding a tour
 *   moves the unit back to Available unless the status itself is turnover.
 * - Turn Over / Turnover In Progress → Coming Up, shown to brokers and administrators
 * - Reserve / Reserved, including Turnover-reserved → not shown. Brokers and
 *   administrators both skip these units: no board section, unit page, count, or nav.
 * - Application In Process (any wording with "application") → Available when the
 *   unit has a Matterport tour, shown to brokers and administrators with an
 *   "Application In Process" badge. This wins over a Reserved match in the same
 *   text and over a `listings.reserved` row. Without a tour it is Coming Up.
 *
 * Any other status (credit check, under initial development, blank) stays in
 * Available when the unit has a Matterport tour, and the card keeps the sheet wording.
 * Without a tour it is Coming Up.
 * A row in `listings.reserved` is not rendered. If an apartments row reuses that
 * id with a different status, the apartments row is the one shown (one card,
 * one unit page). The archived row stays off the board. When the apartments
 * row still has the archived status, it stays hidden. Application In Process
 * stays visible either way.
 * A broker claim is not written into that file. Callers pass its unit id in
 * `extraReservedIds`. A claim removes the unit from the site for every role.
 */

export type BoardSectionId = "available" | "coming-up" | "reserved";

export type BoardGroup = {
  id: BoardSectionId;
  title: string;
  lede: string;
  listings: Listing[];
};

export const BOARD_SECTIONS: readonly { id: Exclude<BoardSectionId, "reserved">; title: string; lede: string }[] = [
  {
    id: "available",
    title: "Available",
    lede: "Units brokers can show. A card keeps the sheet status when it is not simply Available.",
  },
  {
    id: "coming-up",
    title: "Coming Up",
    lede: "No Matterport tour yet, or still turning over. This section is below Available.",
  },
];

const RESERVED_STATUS = /\breserv(?:e|ed|ation)\b/;
const APPLICATION_STATUS = /\bapplication\b/;
export const APPLICATION_IN_PROCESS = "Application In Process";
const TURNOVER_STATUS = /turn\s*over/;
const MATTERPORT_TOUR = /matterport\.com/i;

function normalizeStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/[.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sheet status "Application In Process (not yet approved)" and similar wording. */
export function isApplicationInProcess(status: string): boolean {
  return APPLICATION_STATUS.test(normalizeStatus(status));
}

/** A real Matterport link. Any other URL, or none, leaves the unit in Coming Up. */
export function hasMatterportTour(listing: Pick<Listing, "tours">): boolean {
  return (listing.tours ?? []).some((tour) => MATTERPORT_TOUR.test(tour?.url ?? ""));
}

/** Map a sheet status string onto a board section. */
export function statusBoardSection(status: string): BoardSectionId {
  const value = normalizeStatus(status);
  if (!value) return "available";
  if (isApplicationInProcess(status)) return "available";
  if (RESERVED_STATUS.test(value)) return "reserved";
  if (TURNOVER_STATUS.test(value)) return "coming-up";
  return "available";
}

/**
 * Ids from `listings.reserved` that hide an apartments row.
 * A live apartments row with a different status is left out of this set, so
 * the sheet row is shown once and the archived row is not a second card.
 * Ids that exist only in `listings.reserved` are included; those rows are not
 * in the apartments list, so they still do not appear.
 */
export function reservedIdsThatHide(apartments: readonly Listing[], reserved: readonly Listing[]): Set<string> {
  const liveStatus = new Map<string, string>();
  for (const listing of apartments) {
    if (!liveStatus.has(listing.id)) liveStatus.set(listing.id, listing.status);
  }
  const ids = new Set<string>();
  for (const archived of reserved) {
    const status = liveStatus.get(archived.id);
    if (status != null && status !== archived.status) continue;
    ids.add(archived.id);
  }
  return ids;
}

/**
 * Sheet reserved wording, a broker claim, or an archived reserved id whose
 * apartments row still has that same status.
 * Application In Process stays visible even when the same text or id also matches reserved.
 */
export function isReservedListing(listing: Listing, reservedIds: ReadonlySet<string>): boolean {
  if (isApplicationInProcess(listing.status)) return false;
  if (reservedIds.has(listing.id)) return true;
  return statusBoardSection(listing.status) === "reserved";
}

export function boardSectionFor(listing: Listing, reservedIds: ReadonlySet<string>): BoardSectionId {
  if (isReservedListing(listing, reservedIds)) return "reserved";
  if (!hasMatterportTour(listing)) return "coming-up";
  return statusBoardSection(listing.status);
}

/** Broker-facing label. Coming Up and Reserved replace the raw sheet wording. */
export function displayedStatus(status: string, section?: BoardSectionId): string {
  const resolved = section ?? statusBoardSection(status);
  if (resolved === "coming-up") return "Coming Up";
  if (resolved === "reserved") return "Reserved";
  if (isApplicationInProcess(status)) return APPLICATION_IN_PROCESS;
  if (normalizeStatus(status) === "available") return "Available";
  return statusLabel(status);
}

const textCompare = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Unknown bedroom counts sort after every known count, including studios. */
function bedroomRank(listing: Listing): number {
  const beds = bedCount(listing);
  if (beds == null || !Number.isFinite(beds)) return Number.POSITIVE_INFINITY;
  return beds;
}

/**
 * Studios (0 bedrooms) first, then 1, 2, 3, and so on.
 * Same bedroom count is ordered by address, then unit.
 */
export function compareApartmentsByBedrooms(a: Listing, b: Listing): number {
  const left = bedroomRank(a);
  const right = bedroomRank(b);
  if (left !== right) return left > right ? 1 : -1;
  const address = textCompare.compare(a.address, b.address);
  if (address !== 0) return address;
  const unit = textCompare.compare(a.unit, b.unit);
  if (unit !== 0) return unit;
  return textCompare.compare(a.id, b.id);
}

/** Available and Coming Up only. Reserved rows are dropped for every viewer. */
export function groupBoardListings(
  apartments: Listing[],
  reserved: Listing[],
  options: { extraReservedIds?: Iterable<string> } = {},
): BoardGroup[] {
  const reservedIds = reservedIdsThatHide(apartments, reserved);
  if (options.extraReservedIds) {
    for (const id of options.extraReservedIds) reservedIds.add(id);
  }
  const buckets: Record<"available" | "coming-up", Listing[]> = {
    available: [],
    "coming-up": [],
  };
  const seen = new Set<string>();
  for (const listing of apartments) {
    if (seen.has(listing.id)) continue;
    seen.add(listing.id);
    const section = boardSectionFor(listing, reservedIds);
    if (section === "reserved") continue;
    buckets[section].push(listing);
  }
  return BOARD_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    lede: section.lede,
    listings: buckets[section.id].sort(compareApartmentsByBedrooms),
  }));
}
