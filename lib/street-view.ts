import manifest from "@/data/street-view-manifest.json";
import { addressKey } from "./address-key.mjs";
import type { Listing } from "./types";

export type ExteriorKind = "streetview" | "map";

export type ExteriorPhoto = {
  src: string;
  kind: ExteriorKind;
  alt: string;
  credit: string;
};

type Manifest = {
  photos: Record<string, ExteriorPhoto>;
};

const photos = (manifest as Manifest).photos ?? {};

export function exteriorFor(listing: Pick<Listing, "category" | "address">): ExteriorPhoto | null {
  if (listing.category !== "apartment") return null;
  const photo = photos[addressKey(listing.address)];
  if (!photo?.src) return null;
  return photo;
}

export function assertApartmentExteriors(listings: { address: string }[]) {
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const listing of listings) {
    const key = addressKey(listing.address);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!photos[key]?.src) missing.push(listing.address);
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing exterior photo for ${missing.join(", ")}. Run: npm run streetview`,
    );
  }
}
