import raw from "@/data/rental-listings.json";
import { addressKey, unitKey } from "./match";
import { assertApartmentExteriors } from "./street-view";
import type { Category, InventoryFile, Listing, TrackerRow } from "./types";

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

export const CATEGORY_ORDER: { category: Category; href: string; label: string; title: string; lede: string }[] = [
  {
    category: "apartment",
    href: "/",
    label: "Apartments",
    title: "Apartments",
    lede: "Residential vacancies from the office sheet. Filter by bedrooms and bathrooms. Each card shows a street-level photo of the building, plus rents, program flags, and a Matterport tour when a link is on file.",
  },
  {
    category: "commercial",
    href: "/commercial",
    label: "Commercial",
    title: "Commercial",
    lede: "Retail and storefront space, including extra Matterport links when one address has more than one tour.",
  },
  {
    category: "garage",
    href: "/garages",
    label: "Garages",
    title: "Garages",
    lede: "Garage spaces from the office sheet. Storage rooms and sheds are listed separately.",
  },
  {
    category: "storage",
    href: "/storages",
    label: "Storages",
    title: "Storages",
    lede: "Storage rooms and sheds from the office sheet.",
  },
];

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

export function categoryMeta(category: Category) {
  return CATEGORY_ORDER.find((item) => item.category === category) ?? CATEGORY_ORDER[0];
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
