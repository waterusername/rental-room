import { statusLabel } from "./format";
import type { Listing } from "./types";

/**
 * Apartment board sections follow the Available Apartments Broker sheet.
 * The site does not read that sheet live. Each unit's `status` in
 * data/rental-listings.json is the source of truth (see README, "Refresh the listings").
 *
 * - Available → Available, shown to brokers and administrators
 * - Turn Over / Turnover In Progress → Coming Up, shown to brokers and administrators
 * - Reserve / Reserved → Reserved, administrators only
 *
 * Any other status (credit check, under initial development, blank) stays in
 * Available so it remains broker-visible, and the card keeps the sheet wording.
 * A row in `listings.reserved` is Reserved even when its status text differs.
 * A broker claim is not written into that file. Callers pass its unit id in
 * `extraReservedIds`, and it uses this same reserved bucket.
 */

export type BoardSectionId = "available" | "coming-up" | "reserved";

export type BoardGroup = {
  id: BoardSectionId;
  title: string;
  lede: string;
  listings: Listing[];
};

export const BOARD_SECTIONS: readonly { id: BoardSectionId; title: string; lede: string }[] = [
  {
    id: "available",
    title: "Available",
    lede: "Units brokers can show. A card keeps the sheet status when it is not simply Available.",
  },
  {
    id: "coming-up",
    title: "Coming Up",
    lede: "Still turning over, so these units are not listed as Available.",
  },
  {
    id: "reserved",
    title: "Reserved",
    lede: "Marked Reserve or Reserved on the sheet, or claimed by a broker. Only administrators see this section, and these units are not shared.",
  },
];

const RESERVED_STATUS = /\breserv(?:e|ed|ation)\b/;
const TURNOVER_STATUS = /turn\s*over/;

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

/** Map a sheet status string onto a board section. */
export function statusBoardSection(status: string): BoardSectionId {
  const value = normalizeStatus(status);
  if (!value) return "available";
  if (RESERVED_STATUS.test(value)) return "reserved";
  if (TURNOVER_STATUS.test(value)) return "coming-up";
  return "available";
}

export function boardSectionFor(listing: Listing, reservedIds: ReadonlySet<string>): BoardSectionId {
  if (reservedIds.has(listing.id)) return "reserved";
  return statusBoardSection(listing.status);
}

export function isReservedListing(listing: Listing, reservedIds: ReadonlySet<string>): boolean {
  return boardSectionFor(listing, reservedIds) === "reserved";
}

/** Broker-facing label. Coming Up and Reserved replace the raw sheet wording. */
export function displayedStatus(status: string, section?: BoardSectionId): string {
  const resolved = section ?? statusBoardSection(status);
  if (resolved === "coming-up") return "Coming Up";
  if (resolved === "reserved") return "Reserved";
  if (normalizeStatus(status) === "available") return "Available";
  return statusLabel(status);
}

export function groupBoardListings(
  apartments: Listing[],
  reserved: Listing[],
  options: { includeReserved: boolean; extraReservedIds?: Iterable<string> },
): BoardGroup[] {
  const reservedIds = new Set(reserved.map((listing) => listing.id));
  if (options.extraReservedIds) {
    for (const id of options.extraReservedIds) reservedIds.add(id);
  }
  const buckets: Record<BoardSectionId, Listing[]> = {
    available: [],
    "coming-up": [],
    reserved: [],
  };
  const seen = new Set<string>();
  for (const listing of [...apartments, ...reserved]) {
    if (seen.has(listing.id)) continue;
    seen.add(listing.id);
    buckets[boardSectionFor(listing, reservedIds)].push(listing);
  }
  return BOARD_SECTIONS.filter((section) => options.includeReserved || section.id !== "reserved").map(
    (section) => ({
      id: section.id,
      title: section.title,
      lede: section.lede,
      listings: buckets[section.id],
    }),
  );
}
