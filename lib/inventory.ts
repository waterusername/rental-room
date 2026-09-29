import raw from "@/data/rental-listings.json";
import { boardSectionFor, groupBoardListings, isReservedListing as listingIsReserved } from "./board";
import type { BoardGroup, BoardSectionId } from "./board";
import { CATEGORY_ORDER } from "./categories";
import { addressKey, unitKey } from "./match";
import { assertApartmentExteriors } from "./street-view";
import type { Category, InventoryFile, Listing, TrackerRow } from "./types";

export type { BoardGroup, BoardSectionId };

export { CATEGORY_ORDER, categoryMeta } from "./categories";

function asInventory(value: InventoryFile): InventoryFile {
  const groups = [
    "apartments",
    "commercial",
    "garages",
    "storages",
    "pipeline",
    "reserved",
    "residentialTracker",
  ] as const;
  for (const key of groups) {
    if (!Array.isArray(value.listings[key])) {
      throw new Error(`data/rental-listings.json is missing listings.${key}`);
    }
  }
  if (!value.contact?.applyEmail) {
    throw new Error("data/rental-listings.json is missing contact.applyEmail");
  }
  return value;
}

export const inventory = asInventory(raw as InventoryFile);

assertApartmentExteriors(inventory.listings.apartments);

const listingsByCategory: Record<Category, Listing[]> = {
  apartment: inventory.listings.apartments,
  commercial: inventory.listings.commercial,
  garage: inventory.listings.garages,
  storage: inventory.listings.storages,
};

export function listingsFor(category: Category): Listing[] {
  return listingsByCategory[category];
}

export function allListings(): Listing[] {
  return CATEGORY_ORDER.flatMap((item) => listingsByCategory[item.category]);
}

export function getListing(id: string): Listing | undefined {
  return allListings().find((listing) => listing.id === id);
}

const reservedIds: ReadonlySet<string> = new Set(inventory.listings.reserved.map((listing) => listing.id));

function reservedIdSet(extraReservedIds?: Iterable<string>): ReadonlySet<string> {
  if (!extraReservedIds) return reservedIds;
  const ids = new Set(reservedIds);
  for (const id of extraReservedIds) ids.add(id);
  return ids;
}

/** Sheet reserved ids, plus broker claims when those ids are passed in. */
export function listingReservedIds(extraReservedIds?: Iterable<string>): ReadonlySet<string> {
  return reservedIdSet(extraReservedIds);
}

export function routableListings(): Listing[] {
  const seen = new Set<string>();
  const rows: Listing[] = [];
  for (const listing of [...allListings(), ...inventory.listings.reserved]) {
    if (seen.has(listing.id)) continue;
    seen.add(listing.id);
    rows.push(listing);
  }
  return rows;
}

export function findListing(id: string): Listing | undefined {
  return routableListings().find((listing) => listing.id === id);
}

export function isReservedListing(listing: Listing, extraReservedIds?: Iterable<string>): boolean {
  return listingIsReserved(listing, reservedIdSet(extraReservedIds));
}

export function sectionFor(listing: Listing, extraReservedIds?: Iterable<string>): BoardSectionId {
  return boardSectionFor(listing, reservedIdSet(extraReservedIds));
}

/**
 * Broker groups omit Reserved. Administrators can include that section.
 * `extraReservedIds` are broker claims. They use the same reserved bucket as sheet rows.
 */
export function apartmentBoardGroups(includeReserved: boolean, extraReservedIds?: Iterable<string>): BoardGroup[] {
  return groupBoardListings(inventory.listings.apartments, inventory.listings.reserved, {
    includeReserved,
    extraReservedIds,
  });
}

export function trackerFor(listing: Listing): TrackerRow | null {
  if (listing.category !== "apartment") return null;
  const address = addressKey(listing.address);
  const unit = unitKey(listing.unit);
  return (
    inventory.listings.residentialTracker.find(
      (row) => addressKey(row.address) === address && unitKey(row.unit) === unit,
    ) ?? null
  );
}

export function trackedIds(listings: Listing[]): Set<string> {
  const ids = new Set<string>();
  for (const listing of listings) {
    if (trackerFor(listing)) ids.add(listing.id);
  }
  return ids;
}
