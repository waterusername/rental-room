import raw from "@/data/rental-listings.json";
import { CATEGORY_ORDER } from "./categories";
import { addressKey, unitKey } from "./match";
import { assertApartmentExteriors } from "./street-view";
import type { Category, InventoryFile, Listing, TrackerRow } from "./types";

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
