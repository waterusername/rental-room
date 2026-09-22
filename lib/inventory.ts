import raw from "@/data/rental-listings.json";
import { addressKey, unitKey } from "./match";
import type { Category, InventoryFile, Listing, TrackerRow } from "./types";

function asInventory(value: InventoryFile): InventoryFile {
  const groups = [
    "apartments",
    "garagesStorage",
    "commercial",
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

export const CATEGORY_ORDER: { category: Category; href: string; label: string; title: string; lede: string }[] = [
  {
    category: "apartment",
    href: "/",
    label: "Apartments",
    title: "Apartments",
    lede: "Residential vacancies from the office sheet. Rents, program flags, days vacant, and a Matterport tour when a link is on file.",
  },
  {
    category: "garage-storage",
    href: "/garages",
    label: "Garages & Storage",
    title: "Garages & storage",
    lede: "Garages, sheds, and storage rooms. Rows from the apartment sheet and the garage sheet are combined when they are the same space.",
  },
  {
    category: "commercial",
    href: "/commercial",
    label: "Commercial",
    title: "Commercial",
    lede: "Retail and storefront space, including extra Matterport links when one address has more than one tour.",
  },
  {
    category: "pipeline",
    href: "/pipeline",
    label: "Pipeline",
    title: "Pipeline",
    lede: "Units still under construction or gut renovation, with the potential rent listed on the upcoming sheet.",
  },
  {
    category: "reserved",
    href: "/reserved",
    label: "Reserved",
    title: "Reserved",
    lede: "Apartments held for an applicant. Dates, bedroom counts, and office notes come from the reservation log.",
  },
];

const listingsByCategory: Record<Category, Listing[]> = {
  apartment: inventory.listings.apartments,
  "garage-storage": inventory.listings.garagesStorage,
  commercial: inventory.listings.commercial,
  pipeline: inventory.listings.pipeline,
  reserved: inventory.listings.reserved,
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
